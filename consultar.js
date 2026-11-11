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
        tlsOptions: { rejectUnauthorized: false }
    };

    return new Promise((resolve) => {
        const imap = new Imap(imapConfig);
        let encontrado = false;

        imap.once('ready', () => {
            imap.openBox('INBOX', true, (err, box) => {
                if (err) {
                    imap.end();
                    return res.status(500).json({ success: false, message: 'Error al abrir el buzón IMAP' });
                }

                // Buscamos correos recientes (últimos 50 o filtrados por texto)
                imap.search(['ALL'], (err, results) => {
                    if (err || !results || results.length === 0) {
                        imap.end();
                        return res.json({ success: false, message: 'No se encontraron correos en el buzón.' });
                    }

                    // Tomamos los últimos 15 correos más recientes
                    const recentResults = results.slice(-15).reverse();
                    let fetchedCount = 0;

                    const f = imap.fetch(recentResults, { bodies: '' });

                    f.on('message', (msg, seqno) => {
                        let mailBuffer = '';
                        msg.on('body', (stream) => {
                            stream.on('data', (chunk) => {
                                mailBuffer += chunk.toString();
                            });
                        });

                        msg.once('end', async () => {
                            try {
                                const parsed = await simpleParser(mailBuffer);
                                const subject = parsed.subject || '';
                                const textBody = parsed.text || parsed.html || '';

                                // Verificamos si el correo pertenece o menciona a la cuenta consultada
                                if (!encontrado && (textBody.includes(correo) || subject.includes(correo))) {
                                    // Expresión regular para buscar códigos de 4 a 6 dígitos típicos de verificación
                                    const codigoMatch = textBody.match(/\b\d{4,6}\b/);
                                    
                                    if (codigoMatch) {
                                        encontrado = true;
                                        imap.end();
                                        return res.json({
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
                                imap.end();
                                res.json({ success: false, message: 'No se encontró ningún código reciente para este correo.' });
                            }
                        });
                    });

                    f.once('error', (fetchErr) => {
                        imap.end();
                        res.status(500).json({ success: false, message: 'Error al leer los mensajes' });
                    });
                });
            });
        });

        imap.once('error', (err) => {
            console.error('Error IMAP:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: 'Error de conexión con el servidor de correo.' });
            }
        });

        imap.connect();
    });
}