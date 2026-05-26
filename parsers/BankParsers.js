const MAX_BODY_SIZE = 512000; // 500KB in bytes

class BankParsers {

    static getParser(fromEmail) {
        if (fromEmail.includes("DAVIbankInforma@davibank.com") || fromEmail.includes("colpatriaInforma@scotiabankcolpatria.com")) {
            return this.parseDavibank;
        } else if (fromEmail.includes("alertasynotificaciones@notificacionesbancolombia.com") || fromEmail.includes("alertasynotificaciones@bancolombia.com.co") || fromEmail.includes("alertasynotificaciones@an.notificacionesbancolombia.com")) {
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


    static parseDavibank(body, date) {
        const startTime = Date.now();
        try {
            body = BankParsers.sanitizeHtml(body);
            if (body === null) return null;

            if (BankParsers._checkTimeout(startTime, 'Davibank')) return null;

            // New format: key-value table rows like:
            // <td>Comercio</td><td>DLO*Didi</td>
            // <td>Monto</td><td>9,950</td>
            // <td>Fecha</td><td>2026/04/10</td>
            const rowRegex = /<tr[^>]*>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gi;
            const fields = {};
            let match;

            while ((match = rowRegex.exec(body)) !== null) {
                if (BankParsers._checkTimeout(startTime, 'Davibank')) return null;
                const key = match[1].replace(/<[^>]*>/g, '').trim().toLowerCase();
                const value = match[2].replace(/<[^>]*>/g, '').trim();
                fields[key] = value;
            }

            const store = fields['comercio'] || fields['commerce'] || '';
            const amountStr = fields['monto'] || fields['valor'] || '';
            const dateStr = fields['fecha'] || '';

            if (!store || !amountStr) return null;

            // COP amounts: comma and dot are thousands separators, no decimals
            const amount = parseFloat(amountStr.replace(/[.,]/g, ''));

            if (!BankParsers.validateAmount(amount)) {
                console.warn(`Invalid amount parsed from Davibank email: ${amount}`);
                return null;
            }

            // Parse date from email field or fall back to email internalDate
            let parsedDate;
            if (dateStr) {
                const parts = dateStr.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
                if (parts) {
                    parsedDate = new Date(parseInt(parts[1]), parseInt(parts[2]) - 1, parseInt(parts[3]));
                }
            }
            if (!parsedDate || isNaN(parsedDate.getTime())) {
                parsedDate = new Date(date);
            }

            if (!BankParsers.validateDate(parsedDate)) {
                console.warn(`Invalid date parsed from Davibank email: ${parsedDate}`);
                return null;
            }

            let categoryName = "Unknown";
            const storeLower = store.toLowerCase();
            if (storeLower.includes("didi")) categoryName = "Mother";
            else if (storeLower.includes("uber")) categoryName = "Transport";
            else if (storeLower.includes("rappi")) categoryName = "Food";

            return {
                amount,
                description: store,
                date: parsedDate,
                type: "expense",
                currency: "COP",
                parserId: "Davibank",
                rawCategory: categoryName
            };
        } catch (e) {
            console.error("Error parsing Davibank:", e);
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
            else if (body.includes("Recibiste") && body.includes("transferencia")) {
                // Format: "Recibiste una transferencia por $100,000 de MAY OSORNO en tu cuenta"
                const amountMatch = body.match(/transferencia por \$([\d.,]+)/);
                if (amountMatch) amount = parseFloat(amountMatch[1].replace(/[.,]/g, ''));

                const nameMatch = body.match(/de\s+([A-Z\s]+?)\s+en\s+tu\s+cuenta/);
                if (nameMatch) {
                    const personName = nameMatch[1].trim();
                    description = `Received from ${personName}`;

                    if (personName.includes("ARREN EL CASTIL")) categoryName = "Arriendo";
                    else if (personName.includes("OSORNO")) categoryName = "Hermanos";
                    else if (personName.includes("SISTEMAS COLOMB")) categoryName = "Bonus";
                    else categoryName = "Income";
                } else {
                    description = "Incoming Transfer";
                    categoryName = "Income";
                }
                type = "income";
            }
            // 3. Payment Reception
            else if (body.includes("recepcion de pago")) {
                const nameMatch = body.match(/recepcion de pago de (.+?) por \$/);
                if (nameMatch) {
                    description = `Payment from ${nameMatch[1].trim()}`;
                    categoryName = "Bonus";
                    const amountMatch = body.match(/\$([\d.,]+)/);
                    if (amountMatch) amount = parseFloat(amountMatch[1].replace(/[.,]/g, ''));
                }
                type = "income";
            }
            // 4. Outgoing Transfers (Transferiste)
            else if (body.includes("Transferiste")) {
                const amountMatch = body.match(/\$([\d.,]+)/);
                if (amountMatch) {
                    amount = parseFloat(amountMatch[1].replace(/[.,]/g, ''));
                    description = "Transfer";
                    categoryName = "Unknown";
                }
            }
            // 5. QR Payments (pagaste ... por codigo QR)
            else if (body.includes("pagaste") && body.includes("codigo QR")) {
                const amountMatch = body.match(/pagaste \$([\d.,]+)/);
                if (amountMatch) {
                    amount = parseFloat(amountMatch[1].replace(/[.,]/g, ''));
                    description = "QR Payment";
                    categoryName = "Unkown";
                }
            }
            // 6. Generic: any email with "Bancolombia" and a $ amount
            else if (body.includes("Bancolombia") && body.match(/\$([\d.,]+)/)) {
                const amountMatch = body.match(/\$([\d.,]+)/);
                if (amountMatch) {
                    amount = parseFloat(amountMatch[1].replace(/[.,]/g, ''));
                    description = "Bancolombia Transaction";
                }
            }

            if (BankParsers._checkTimeout(startTime, 'Bancolombia')) return null;

            if (amount > 0) {
                if (!BankParsers.validateAmount(amount)) {
                    console.warn(`Invalid amount parsed from Bancolombia email: ${amount}`);
                    return null;
                }

                // Try to extract date from body (format: "el 29/03/2026" or "el 29/03/2026")
                let parsedDate;
                const dateMatch = body.match(/el\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (dateMatch) {
                    parsedDate = new Date(parseInt(dateMatch[3]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
                }
                if (!parsedDate || isNaN(parsedDate.getTime())) {
                    parsedDate = new Date(date);
                }
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
