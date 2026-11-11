import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

if (!getApps().length) {
    initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}'))
    });
}
const db = getFirestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    const { correo } = req.body;
    if (!correo) {
        return res.status(400).json({ success: false, message: 'Correo requerido' });
    }

    try {
        const configDoc = await db.collection('configuracion_codigos').doc('principal').get();
        if (!configDoc.exists) {
            return res.status(500).json({ success: false, message: 'No hay configuración IMAP guardada en Firebase.' });
        }

        const config = configDoc.data();
        const imapConfig = {
            user: config.imap_user,
            password: config.imap_password,
            host: config.imap_host || 'imap.gmail.com',
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
                        return res.status(500).json({ success: false, message: 'Error al abrir el buzón IMAP.' });
                    }

                    imap.search(['ALL'], (err, results) => {
                        if (err || !results || results.length === 0) {
                            imap.end();
                            return res.json({ success: false, message: 'El buzón está vacío.' });
                        }

                        const recentResults = results.slice(-20).reverse();
                        let fetchedCount = 0;
                        const f = imap.fetch(recentResults, { bodies: '' });

                        f.on('message', (msg, seqno) => {
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

                        f.once('error', () => {
                            imap.end();
                            res.status(500).json({ success: false, message: 'Error al leer los mensajes del buzón.' });
                        });
                    });
                });
            });

            imap.once('error', (err) => {
                console.error('Error IMAP:', err);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, message: 'Error de autenticación o conexión IMAP.' });
                }
            });

            imap.connect();
        });

    } catch (e) {
        console.error('Error general:', e);
        return res.status(500).json({ success: false, message: 'Error interno conectando con Firebase o el servidor.' });
    }
}