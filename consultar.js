export default async function handler(req, res) {
    // Permitir CORS para que su web pueda consultarlo sin problemas
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { correo, asunto } = req.query;

    if (!correo) {
        return res.status(400).json({ success: false, message: "Falta el parámetro de correo." });
    }

    try {
        // Aquí conectamos con la lógica de búsqueda o su API de correo preferida
        // Por ahora simularemos la respuesta estructurada que espera su index.html
        
        return res.status(200).json({
            success: true,
            codigo: "847291", // Aquí viajará el código extraído del último correo
            asunto: asunto || "Correo de verificación",
            cuerpo: "Contenido detallado del último correo recibido en la bandeja...",
            fecha: new Date().toLocaleString()
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.toString() });
    }
}
