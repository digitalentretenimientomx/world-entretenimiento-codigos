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
                message: "La base de datos está conectada pero no devolvió ningún documento." 
            });
        }

        const correoBuscado = correo.trim().toLowerCase();
        const asuntoBuscado = asunto ? asunto.trim().toLowerCase() : "";

        let registrosDelCorreo = [];
        let mejorCoincidencia = null;

        // Recorremos todos los documentos
        for (const doc of data.documents) {
            const fields = doc.fields || {};
            
            // Extraemos los posibles nombres de campos que use su base de datos
            const correoDoc = (fields.correo?.stringValue || fields.email?.stringValue || "").trim().toLowerCase();
            const asuntoDoc = (fields.asunto?.stringValue || fields.subject?.stringValue || fields.titulo?.stringValue || "").trim().toLowerCase();
            const asuntoOriginal = fields.asunto?.stringValue || fields.subject?.stringValue || fields.titulo?.stringValue || "Sin Asunto";
            const codigo = fields.codigo?.stringValue || fields.code?.stringValue || "------";
            const cuerpo = fields.cuerpo?.stringValue || fields.mensaje?.stringValue || fields.body?.stringValue || "Sin contenido detallado";
            const fechaStr = fields.fecha?.stringValue || fields.date?.stringValue || "Reciente";
            const timestamp = fields.fecha?.stringValue ? new Date(fields.fecha.stringValue).getTime() : 0;

            if (correoDoc === correoBuscado) {
                registrosDelCorreo.push({ asuntoDoc, asuntoOriginal, timestamp });

                // Verificamos si coincide el asunto (flexible para evitar falsos negativos por espacios o minúsculas)
                const coincideAsunto = !asuntoBuscado || asuntoDoc.includes(asuntoBuscado) || asuntoBuscado.includes(asuntoDoc);

                if (coincideAsunto) {
                    if (!mejorCoincidencia || timestamp >= mejorCoincidencia.timestamp) {
                        mejorCoincidencia = {
                            codigo,
                            asunto: asuntoOriginal,
                            cuerpo,
                            fecha: fechaStr,
                            timestamp
                        };
                    }
                }
            }
        }

        if (mejorCoincidencia) {
            return res.status(200).json({
                success: true,
                codigo: mejorCoincidencia.codigo,
                asunto: mejorCoincidencia.asunto,
                cuerpo: mejorCoincidencia.cuerpo,
                fecha: mejorCoincidencia.fecha
            });
        } else {
            // Si no encontró coincidencia de asunto, devolvemos los asuntos que SÍ encontró para este correo en el mensaje de error
            return res.status(200).json({ 
                success: false, 
                message: `Correos encontrados para ${correo}, pero ninguno coincide con "${asunto}". Asuntos en BD: [${registrosDelCorreo.map(r => r.asuntoOriginal).join(" | ")}]` 
            });
        }

    } catch (error) {
        return res.status(500).json({ success: false, message: "Error al consultar: " + error.toString() });
    }
}