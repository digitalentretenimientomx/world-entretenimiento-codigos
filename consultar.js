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

        const correoBuscado = correo.trim().toLowerCase();
        
        // Limpiamos el texto del asunto recibido para extraer solo la parte clave entre paréntesis o usar palabras clave
        let filtroAsunto = asunto ? asunto.trim().toLowerCase() : "";
        if (filtroAsunto.includes("-")) {
            // Si viene con formato "PLATAFORMA - (Asunto)", extraemos lo que está dentro del paréntesis o la parte clave
            const partes = filtroAsunto.split("-");
            filtroAsunto = partes[partes.length - 1].replace(/[()]/g, "").trim();
        }

        let mejorCoincidencia = null;
        let registrosLeidos = [];

        for (const doc of data.documents) {
            const fields = doc.fields || {};
            
            const correoDoc = (fields.correo?.stringValue || fields.email?.stringValue || "").trim().toLowerCase();
            const asuntoDoc = (fields.asunto?.stringValue || fields.subject?.stringValue || fields.titulo?.stringValue || "").trim().toLowerCase();
            const asuntoOriginal = fields.asunto?.stringValue || fields.subject?.stringValue || fields.titulo?.stringValue || "Sin Asunto";
            const codigo = fields.codigo?.stringValue || fields.code?.stringValue || "------";
            const cuerpo = fields.cuerpo?.stringValue || fields.mensaje?.stringValue || fields.body?.stringValue || "Sin contenido detallado";
            const fechaStr = fields.fecha?.stringValue || fields.date?.stringValue || "Reciente";
            const timestamp = fields.fecha?.stringValue ? new Date(fields.fecha.stringValue).getTime() : 0;

            if (correoDoc === correoBuscado) {
                registrosLeidos.push(asuntoOriginal);

                // Verificación flexible pero estricta de palabras clave del asunto
                const coincideAsunto = !filtroAsunto || asuntoDoc.includes(filtroAsunto) || filtroAsunto.includes(asuntoDoc);

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
            return res.status(200).json({ 
                success: false, 
                message: `No se encontró coincidencia para "${filtroAsunto}". Correos de este usuario en BD: [${registrosLeidos.join(" | ")}]` 
            });
        }

    } catch (error) {
        return res.status(500).json({ success: false, message: "Error al consultar: " + error.toString() });
    }
}