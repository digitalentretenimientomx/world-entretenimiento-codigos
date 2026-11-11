export default async function handler(req, res) {
    // Permitir solicitudes POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    try {
        let correo = '';

        // Extraer el correo sin importar si viene como objeto o texto plano
        if (req.body) {
            if (typeof req.body === 'object') {
                correo = req.body.correo;
            } else if (typeof req.body === 'string') {
                try {
                    const parsed = JSON.parse(req.body);
                    correo = parsed.correo;
                } catch (e) {
                    correo = req.body;
                }
            }
        }

        if (!correo) {
            return res.status(400).json({ success: false, message: 'Correo requerido' });
        }

        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw3lmpp3cjfbqepZipEoJEjxjr76zTO-GcpqmOgQ5DytkFwkQsPjY7wp6rUEBNsf4Ek/exec';

        // Realizar la consulta al script de Google
        const response = await fetch(`${GOOGLE_SCRIPT_URL}?correo=${encodeURIComponent(correo)}`);
        
        if (!response.ok) {
            return res.status(500).json({ success: false, message: 'Error de comunicación con Google.' });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error detallado:', error);
        return res.status(500).json({ success: false, message: 'Error al conectar con el servidor de consulta.' });
    }
}