export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    try {
        // Asegura la lectura del correo ya sea desde JSON directo o texto plano
        let correo = req.body?.correo;
        if (!correo && typeof req.body === 'string') {
            try {
                const parsedBody = JSON.parse(req.body);
                correo = parsedBody.correo;
            } catch (e) {}
        }

        if (!correo) {
            return res.status(400).json({ success: false, message: 'Correo requerido' });
        }

        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw3lmpp3cjfbqepZipEoJEjxjr76zTO-GcpqmOgQ5DytkFwkQsPjY7wp6rUEBNsf4Ek/exec';

        const response = await fetch(`${GOOGLE_SCRIPT_URL}?correo=${encodeURIComponent(correo)}`);
        
        if (!response.ok) {
            return res.status(500).json({ success: false, message: 'Error al conectar con Google Apps Script.' });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error en la API de consulta:', error);
        return res.status(500).json({ success: false, message: 'Error interno en el servidor de consulta.' });
    }
}