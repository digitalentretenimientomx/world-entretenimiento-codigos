export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    const { correo } = req.body;
    if (!correo) {
        return res.status(400).json({ success: false, message: 'Correo requerido' });
    }

    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw3lmpp3cjfbqepZipEoJEjxjr76zTO-GcpqmOgQ5DytkFwkQsPjY7wp6rUEBNsf4Ek/exec';

    try {
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?correo=${encodeURIComponent(correo)}`);
        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error consultando Google Script:', error);
        return res.status(500).json({ success: false, message: 'Error al conectar con el servidor de consulta.' });
    }
}