export default async function handler(req, res) {
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
        // Respuesta estructurada de prueba para verificar que la API responde correctamente en Vercel
        return res.status(200).json({
            success: true,
            codigo: "482910",
            asunto: asunto || "Tu código de acceso único",
            cuerpo: `Estimado usuario, su código de verificación solicitado para ${correo} es: 482910. Utilice este código para completar su inicio de sesión.`,
            fecha: new Date().toLocaleString()
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: "Error en el servidor: " + error.toString() });
    }
}
