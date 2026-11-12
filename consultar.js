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

        // 1. Convertir los documentos a un arreglo estructurado y ordenarlos del más NUEVO al más ANTIGUO
        const documentos = data.documents.map(doc => {
            const fields = doc.fields || {};
            return {
                correo: fields.correo && fields.correo.stringValue ? fields.correo.stringValue.trim().toLowerCase() : "",
                asunto: fields.asunto && fields.asunto.stringValue ? fields.asunto.stringValue.trim().toLowerCase() : "",
                asuntoOriginal: fields.asunto && fields.asunto.stringValue ? fields.asunto.stringValue : "",
                codigo: fields.codigo && fields.codigo.stringValue ? fields.codigo.stringValue : "------",
                cuerpo: fields.cuerpo && fields.cuerpo.stringValue ? fields.cuerpo.stringValue : (fields.mensaje && fields.mensaje.stringValue ? fields.mensaje.stringValue : "Sin contenido detallado"),
                fechaStr: fields.fecha && fields.fecha.stringValue ? fields.fecha.stringValue : "",
                // Intentamos extraer una marca de tiempo válida para ordenar con precisión
                timestamp: fields.fecha && fields.fecha.stringValue ? new Date(fields.fecha.stringValue).getTime() : 0
            };
        });

        // Ordenar descendentemente (del más reciente al más antiguo)
        documentos.sort((a, b) => b.timestamp - a.timestamp);

        const correoBuscado = correo.trim().toLowerCase();
        const asuntoBuscado = asunto ? asunto.trim().toLowerCase() : "";

        let mejorCoincidencia = null;

        // 2. Buscar estrictamente el primer registro que coincida con el correo Y con el asunto de la plataforma
        for (const item of documentos) {
            if (item.correo === correoBuscado) {
                const coincideAsunto = !asuntoBuscado || item.asunto.includes(asuntoBuscado) || asuntoBuscado.includes(item.asunto);

                if (coincideAsunto) {
                    mejorCoincidencia = {
                        codigo: item.codigo,
                        asunto: item.asuntoOriginal,
                        cuerpo: item.cuerpo,
                        fecha: item.fechaStr || "Reciente"
                    };
                    break; // Al estar ordenados por fecha, el primero que cumple ambas condiciones es el más reciente y exacto
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
                message: `No se encontró ningún correo reciente para ${correo} con el asunto seleccionado.` 
            });
        }

    } catch (error) {
        return res.status(500).json({ success: false, message: "Error al consultar la base de datos: " + error.toString() });
    }
}