const MAX_BODY_SIZE = 512000; // 500KB in bytes

class BankParsers {

    static getParser(fromEmail) {
        if (fromEmail.includes("colpatriaInforma@scotiabankcolpatria.com")) {
            return this.parseColpatria;
        } else if (fromEmail.includes("alertasynotificaciones@notificacionesbancolombia.com") || fromEmail.includes("alertasynotificaciones@bancolombia.com.co")) {
            return this.parseBancolombia;
        }
        return null;
    }

    /**
     * Lightweight HTML sanitizer — no jsdom/DOMPurify dependency.
     * Strips dangerous tags and on* event handler attributes.
     * Safe for serverless environments (no filesystem reads).
     */
    static sanitizeHtml(body) {
        if (!body || typeof body !== 'string') {
            return null;
        }

        const bodySize = Buffer.byteLength(body, 'utf8');
        if (bodySize > MAX_BODY_SIZE) {
            console.warn(`Email body exceeds 500KB limit (${bodySize} bytes). Skipping sanitization.`);
            return null;
        }

        let sanitized = body;

        // Strip <script>...</script> tags and content
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        // Strip <object>, <embed>, <iframe> tags and content
        sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
        sanitized = sanitized.replace(/<embed\b[^>]*\/?>/gi, '');
        sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
        // Strip on* event handler attributes (e.g., onclick, onerror, onload)
        sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

        return sanitized;
    }

    static validateAmount(amount) {
        return Number.isFinite(amount) && amount > 0 && amount < 1_000_000_000;
    }

    static validateDate(date) {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return false;
        }
        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oneDayFuture = new Date(now);
        oneDayFuture.setDate(oneDayFuture.getDate() + 1);
        return date >= oneYearAgo && date <= oneDayFuture;
    }

    static _checkTimeout(startTime, context) {
        const elapsed = Date.now() - startTime;
        if (elapsed > 2000) {
            console.warn(`Regex timeout exceeded (${elapsed}ms) while parsing ${context}. Aborting.`);
            return true;
        }
        return false;
    }


    static parseColpatria(body, date) {
        const startTime = Date.now();
        try {
            body = BankParsers.sanitizeHtml(body);
            if (body === null) return null;

            if (BankParsers._checkTimeout(startTime, 'Colpatria')) return null;

            // Basic HTML stripping for body content analysis if regex fails on raw HTML
            const tableRegex = /<table.*?>([\s\S]*?)<\/table>/i;
            const tableMatch = body.match(tableRegex);

            if (BankParsers._checkTimeout(startTime, 'Colpatria')) return null;

            if (tableMatch) {
                const tableContent = tableMatch[1];
                const rowRegex = /<tr.*?>([\s\S]*?)<\/tr>/gi;
                const rows = tableContent.match(rowRegex);

                if (BankParsers._checkTimeout(startTime, 'Colpatria')) return null;

                // Usually row 1 is header, row 2 is data
                if (rows && rows.length > 1) {
                    const dataRow = rows[1];
                    const dataRegex = /<td.*?>(.*?)<\/td>/gi;
                    const extractedData = [];
                    let dataMatch;

                    while ((dataMatch = dataRegex.exec(dataRow)) !== null) {
                        // Basic HTML tag stripping
                        extractedData.push(dataMatch[1].replace(/<.*?>/g, '').trim());
                    }

                    if (BankParsers._checkTimeout(startTime, 'Colpatria')) return null;

                    if (extractedData.length >= 4) {
                        // Index 0: Comercio (Store)
                        // Index 1: Valor (Amount)
                        const store = extractedData[0];
                        const amountStr = extractedData[1].replace(/,/g, '');
                        const amount = parseFloat(amountStr);

                        if (!BankParsers.validateAmount(amount)) {
                            console.warn(`Invalid amount parsed from Colpatria email: ${amount}`);
                            return null;
                        }

                        const parsedDate = new Date(date);
                        if (!BankParsers.validateDate(parsedDate)) {
                            console.warn(`Invalid date parsed from Colpatria email: ${parsedDate}`);
                            return null;
                        }

                        let categoryName = "Unknown";
                        if (store.toLowerCase().includes("didi")) categoryName = "Mother"; // User logic
                        else if (store.toLowerCase().includes("uber")) categoryName = "Transport";

                        return {
                            amount,
                            description: store,
                            date: parsedDate,
                            type: "expense",
                            currency: "COP",
                            parserId: "Colpatria",
                            rawCategory: categoryName
                        };
                    }
                }
            }
        } catch (e) {
            console.error("Error parsing Colpatria:", e);
        }
        return null;
    }


    static parseBancolombia(body, date) {
        const startTime = Date.now();
        try {
            body = BankParsers.sanitizeHtml(body);
            if (body === null) return null;

            if (BankParsers._checkTimeout(startTime, 'Bancolombia')) return null;

            let amount = 0;
            let description = "Bancolombia Transaction";
            let type = "expense";
            let categoryName = "Unknown"; // Default

            // 1. Scheduled Payments (Factura Programada)
            if (body.includes("Bancolombia informa pago Factura Programada EPM SERVICIOS")) {
                const amountMatch = body.match(/\$([\d\.]+)/);
                if (amountMatch) {
                    amount = parseFloat(amountMatch[1].replace(/\./g, ''));
                    description = "EPM Services";
                    categoryName = "Home";
                }
            }
            else if (body.includes("Bancolombia informa pago Factura Programada CLARO SOLUCION")) {
                const amountMatch = body.match(/\$([\d.]+)/);
                if (amountMatch) {
                    amount = parseFloat(amountMatch[1].replace(/\./g, ''));
                    description = "Claro Solutions";
                    categoryName = "Home";
                }
            }
            // 2. Incoming Transfers (Recibiste)
            else if (body.includes("Bancolombia: Recibiste")) {
                const nameMatch = body.match(/de\s([A-Z\s]*)\s[a-z]+/);
                if (nameMatch) {
                    const personName = nameMatch[1].trim();
                    description = `Received from ${personName}`;
                    type = "income";

                    if (personName.includes("ARREN EL CASTIL")) categoryName = "Arriendo";
                    else if (personName.includes("OSORNO")) categoryName = "Hermanos";
                    else if (personName.includes("SISTEMAS COLOMB")) categoryName = "Bonus";
                    else categoryName = "Income";

                    const amountMatch = body.match(/\$([\d,]+)/);
                    if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                }
            }
            // 3. Payment Reception
            else if (body.includes("Bancolombia le informa recepcion de pago de")) {
                const nameMatch = body.match(/recepcion de pago de (.+?) por \$/);
                if (nameMatch) {
                    description = `Payment from ${nameMatch[1].trim()}`;
                    type = "income";
                    categoryName = "Bonus";
                    const amountMatch = body.match(/\$([\d,]+)/);
                    if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                }
            }
            // 4. Outgoing Transfers (Transferiste)
            else if (body.includes("Bancolombia: Transferiste")) {
                const amountMatch = body.match(/\$([\d,]+)/);
                if (amountMatch) {
                    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                    description = "Transfer Stats";
                    categoryName = "Food"; // User default
                }
            }
            // 5. QR Payments
            else if (body.includes("Realizaste una transferencia con QR por $")) {
                const qrAmountMatch = body.match(/\$([\d,]+)/);
                if (qrAmountMatch) {
                    amount = parseFloat(qrAmountMatch[1].replace(/,/g, ''));
                    description = "QR Payment";
                    categoryName = "Food"; // User default
                }
            }

            if (BankParsers._checkTimeout(startTime, 'Bancolombia')) return null;

            if (amount > 0) {
                if (!BankParsers.validateAmount(amount)) {
                    console.warn(`Invalid amount parsed from Bancolombia email: ${amount}`);
                    return null;
                }

                const parsedDate = new Date(date);
                if (!BankParsers.validateDate(parsedDate)) {
                    console.warn(`Invalid date parsed from Bancolombia email: ${parsedDate}`);
                    return null;
                }

                return {
                    amount,
                    description,
                    date: parsedDate,
                    type,
                    currency: "COP",
                    parserId: "Bancolombia",
                    rawCategory: categoryName
                };
            }

        } catch (e) {
            console.error("Error parsing Bancolombia:", e);
        }
        return null;
    }

}

module.exports = BankParsers;
