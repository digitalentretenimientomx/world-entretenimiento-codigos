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
        const projectId = process.env.FIREBASE_PROJECT_ID || "worldentretenimiento-botdb";
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/codigos`;

        const respuestaFirestore = await fetch(url);
        const data = await respuestaFirestore.json();

        if (!data.documents || data.documents.length === 0) {
            return res.status(200).json({ 
                success: false, 
                message: "No hay registros guardados en la base de datos." 
            });
        }

        let mejorCoincidencia = null;
        const correoBuscado = correo.trim().toLowerCase();
        const asuntoBuscado = asunto ? asunto.trim().toLowerCase() : "";

        // Recorremos todos los documentos para encontrar el que cumpla AMBAS condiciones de manera estricta
        for (const doc of data.documents) {
            const fields = doc.fields;
            const correoDoc = fields.correo && fields.correo.stringValue ? fields.correo.stringValue.trim().toLowerCase() : "";
            const asuntoDoc = fields.asunto && fields.asunto.stringValue ? fields.asunto.stringValue.trim().toLowerCase() : "";

            // 1. Validar que el correo sea exactamente el mismo
            if (correoDoc === correoBuscado) {
                
                // 2. Validar de forma estricta que el asunto del registro contenga o coincida con la plataforma seleccionada
                const coincideAsunto = !asuntoBuscado || asuntoDoc.includes(asuntoBuscado) || asuntoBuscado.includes(asuntoDoc);

                if (coincideAsunto) {
                    mejorCoincidencia = {
                        codigo: fields.codigo ? fields.codigo.stringValue : "------",
                        asunto: fields.asunto ? fields.asunto.stringValue : (asunto || "Verificación"),
                        cuerpo: fields.cuerpo ? fields.cuerpo.stringValue : (fields.mensaje ? fields.mensaje.stringValue : "Sin contenido detallado"),
                        fecha: fields.fecha ? fields.fecha.stringValue : "Reciente"
                    };
                    break; // Al estar ordenados o encontrar el primero válido correspondiente a esa plataforma, lo capturamos
                }
            }
        }

        if (mejorCoincidencia) {
            return res.status(200).json({
                success: true,
                ...mejorCoincidencia
            });
        } else {
            return res.status(200).json({ 
                success: false, 
                message: `No se encontró ningún correo para ${correo} con el asunto: "${asunto || 'Seleccionado'}".` 
            });
        }

    } catch (error) {
        return res.status(500).json({ success: false, message: "Error al consultar la base de datos: " + error.toString() });
    }
}