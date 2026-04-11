
// Optional: Consider using cheerio or simple DOM parsing if available, but for now regex as per user request/simplicity

class BankParsers {

    static getParser(fromEmail) {
        if (fromEmail.includes("colpatriaInforma@scotiabankcolpatria.com")) {
            return this.parseColpatria;
        } else if (fromEmail.includes("alertasynotificaciones@notificacionesbancolombia.com") || fromEmail.includes("alertasynotificaciones@bancolombia.com.co")) {
            return this.parseBancolombia;
        }
        return null;
    }

    static parseColpatria(body, date) {
        try {
            // Basic HTML stripping for body content analysis if regex fails on raw HTML
            const tableRegex = /<table.*?>([\s\S]*?)<\/table>/i;
            const tableMatch = body.match(tableRegex);

            if (tableMatch) {
                const tableContent = tableMatch[1];
                const rowRegex = /<tr.*?>([\s\S]*?)<\/tr>/gi;
                const rows = tableContent.match(rowRegex);

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

                    if (extractedData.length >= 4) {
                        // Index 0: Comercio (Store)
                        // Index 1: Valor (Amount)
                        const store = extractedData[0];
                        const amountStr = extractedData[1].replace(/,/g, '');
                        const amount = parseFloat(amountStr);

                        let categoryName = "Unknown";
                        if (store.toLowerCase().includes("didi")) categoryName = "Mother"; // User logic
                        else if (store.toLowerCase().includes("uber")) categoryName = "Transport";

                        return {
                            amount,
                            description: store,
                            date: new Date(date),
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
        try {
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

                    // Amount format varies, usually $50,000 or $50.000 depending on locale, user script regex uses comma removal for thousands?
                    // Actually Bancolombia usually uses dots for thousands and comma for decimals or just integers. 
                    // User script: body.match(/\$([\d,]+)/) and replace /,/g with '' -> implies 50,000.00 format? 
                    // Let's stick to user script logic:
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

            if (amount > 0) {
                return {
                    amount,
                    description,
                    date: new Date(date),
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
