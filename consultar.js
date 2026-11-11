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

    const user = process.env.IMAP_USER;
    const password = process.env.IMAP_PASSWORD;

    if (!user || !password) {
        return res.status(500).json({ success: false, message: 'Faltan las credenciales IMAP en las variables de entorno de Vercel.' });
    }

    const imap = new Imap({
        user: user,
        password: password,
        host: process.env.IMAP_HOST || 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 15000,
        authTimeout: 15000
    });

    let finished = false;

    const finalize = (status, data) => {
        if (!finished) {
            finished = true;
            try { imap.end(); } catch (e) {}
            if (!res.headersSent) {
                res.status(status).json(data);
            }
        }
    };

    imap.once('ready', () => {
        imap.openBox('INBOX', true, (err, box) => {
            if (err) {
                return finalize(500, { success: false, message: 'No se pudo abrir la bandeja de entrada (INBOX).' });
            }

            // Buscar correos recientes
            imap.search(['ALL'], (err, results) => {
                if (err || !results || results.length === 0) {
                    return finalize(200, { success: false, message: 'El buzón está vacío.' });
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
                        if (encontrado) return;
                        try {
                            const parsed = await simpleParser(mailBuffer);
                            const subject = parsed.subject || '';
                            const textBody = parsed.text || parsed.html || '';

                            if (textBody.includes(correo) || subject.includes(correo)) {
                                const codigoMatch = textBody.match(/\b\d{4,6}\b/);
                                if (codigoMatch) {
                                    encontrado = true;
                                    return finalize(200, {
                                        success: true,
                                        codigo: codigoMatch[0],
                                        asunto: subject,
                                        tiempo: 'Reciente'
                                    });
                                }
                            }
                        } catch (e) {
                            console.error('Error procesando correo:', e);
                        }

                        fetchedCount++;
                        if (fetchedCount >= recentResults.length && !encontrado) {
                            finalize(200, { success: false, message: 'No se encontró ningún código reciente para este correo.' });
                        }
                    });
                });

                f.once('error', () => {
                    finalize(500, { success: false, message: 'Error al procesar los mensajes del buzón.' });
                });
            });
        });
    });

    imap.once('error', (err) => {
        console.error('Error de conexión IMAP:', err);
        finalize(500, { success: false, message: 'Error de autenticación con Gmail. Verifica tu usuario y contraseña de aplicación.' });
    });

    setTimeout(() => {
        finalize(500, { success: false, message: 'Tiempo de espera agotado al conectar con el servidor de correo.' });
    }, 14000);

    try {
        imap.connect();
    } catch (e) {
        finalize(500, { success: false, message: 'Error crítico al iniciar la conexión IMAP.' });
    }
}