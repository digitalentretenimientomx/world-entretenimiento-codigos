import Imap from 'imap';
import { simpleParser } from 'mailparser';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    const { correo } = req.body;
    if (!correo) {
        return res.status(400).json({ success: false, message: 'Correo requerido' });
    }

    const imapConfig = {
        user: process.env.IMAP_USER,
        password: process.env.IMAP_PASSWORD,
        host: process.env.IMAP_HOST || 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000, // Tiempo de espera de conexión (10 segundos)
        authTimeout: 10000
    };

    return new Promise((resolve) => {
        const imap = new Imap(imapConfig);
        let responded = false;

        const sendResponse = (status, data) => {
            if (!responded) {
                responded = true;
                try { imap.end(); } catch (e) {}
                res.status(status).json(data);
                resolve();
            }
        };

        imap.once('ready', () => {
            imap.openBox('INBOX', true, (err, box) => {
                if (err) {
                    return sendResponse(500, { success: false, message: 'Error al abrir el buzón IMAP.' });
                }

                imap.search(['ALL'], (err, results) => {
                    if (err || !results || results.length === 0) {
                        return sendResponse(200, { success: false, message: 'El buzón está vacío.' });
                    }

                    const recentResults = results.slice(-15).reverse();
                    let fetchedCount = 0;
                    let encontrado = false;

                    const f = imap.fetch(recentResults, { bodies: '' });

                    f.on('message', (msg) => {
                        let mailBuffer = '';
                        msg.on('body', (stream) => {
                            stream.on('data', (chunk) => { mailBuffer += chunk.toString(); });
                        });

                        msg.once('end', async () => {
                            try {
                                const parsed = await simpleParser(mailBuffer);
                                const subject = parsed.subject || '';
                                const textBody = parsed.text || parsed.html || '';

                                if (!encontrado && (textBody.includes(correo) || subject.includes(correo))) {
                                    const codigoMatch = textBody.match(/\b\d{4,6}\b/);
                                    if (codigoMatch) {
                                        encontrado = true;
                                        return sendResponse(200, {
                                            success: true,
                                            codigo: codigoMatch[0],
                                            asunto: subject,
                                            tiempo: 'Reciente'
                                        });
                                    }
                                }
                            } catch (e) {
                                console.error('Error parseando correo', e);
                            }

                            fetchedCount++;
                            if (fetchedCount >= recentResults.length && !encontrado) {
                                sendResponse(200, { success: false, message: 'No se encontró ningún código reciente para este correo.' });
                            }
                        });
                    });

                    f.once('error', () => {
                        sendResponse(500, { success: false, message: 'Error al leer los mensajes.' });
                    });
                });
            });
        });

        imap.once('error', (err) => {
            console.error('Error IMAP:', err);
            sendResponse(500, { success: false, message: 'Error de autenticación o conexión con Gmail.' });
        });

        // Timeout de seguridad general de 12 segundos para evitar que la API se cuelgue
        setTimeout(() => {
            sendResponse(500, { success: false, message: 'Tiempo de espera agotado al conectar con el correo.' });
        }, 12000);

        try {
            imap.connect();
        } catch (e) {
            sendResponse(500, { success: false, message: 'No se pudo iniciar la conexión IMAP.' });
        }
    });
}