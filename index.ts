declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };
  function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

// @ts-ignore Deno resolves this HTTPS module at runtime; standard TypeScript tooling may not.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

/**
 * ENRAÍZA
 * Edge Function: send-institutional-code
 *
 * Esta función NO sustituye el correo de confirmación
 * de la cuenta normal de Supabase Auth.
 *
 * Sirve exclusivamente para enviar el código de:
 *
 *     correo institucional
 *             ↓
 *        código 6 dígitos
 *             ↓
 *       identidad ITD
 *
 * Variables necesarias:
 *
 * SUPABASE_URL
 * SUPABASE_SERVICE_ROLE_KEY
 * RESEND_API_KEY
 * INSTITUTIONAL_FROM_EMAIL
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("INSTITUTIONAL_FROM_EMAIL");

if (!SUPABASE_URL) {
  throw new Error("Falta SUPABASE_URL");
}

if (!SERVICE_ROLE_KEY) {
  throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
}

if (!RESEND_API_KEY) {
  throw new Error("Falta RESEND_API_KEY");
}

if (!FROM_EMAIL) {
  throw new Error("Falta INSTITUTIONAL_FROM_EMAIL");
}


/* ============================================================
   CLIENTE SUPABASE ADMIN
   ============================================================ */

const admin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);


/* ============================================================
   CORS
   ============================================================ */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};


/* ============================================================
   RESPUESTA JSON
   ============================================================ */

function responseJson(
  body: unknown,
  status = 200,
): Response {

  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}


/* ============================================================
   ESCAPAR HTML
   ============================================================ */

function escapeHtml(value: unknown): string {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* ============================================================
   EXTRAER CÓDIGO DEL TEXTO GENERADO POR SQL
   ============================================================ */

function extractCode(bodyText: string): string {

  const match = bodyText.match(
    /(?:es:\s*|:\s*)(\d{6})(?:\D|$)/i,
  );

  return match?.[1] ?? "";
}


/* ============================================================
   NOMBRE DE INSTITUCIÓN
   ============================================================ */

async function getInstitutionName(
  institutionId: string,
): Promise<string> {

  const { data, error } = await admin
    .from("institutions")
    .select("name")
    .eq("id", institutionId)
    .maybeSingle();

  if (error) {

    console.warn(
      "No se pudo cargar el nombre de la institución:",
      error.message,
    );

    return "tu institución";
  }

  return String(
    data?.name ?? "tu institución",
  );
}


/* ============================================================
   PLANTILLA DE CORREO
   ============================================================ */

function institutionEmailHtml(params: {
  code: string;
  institutionName: string;
  role: string;
}): string {

  const code =
    escapeHtml(params.code);

  const institution =
    escapeHtml(
      params.institutionName ||
      "tu institución",
    );

  const roleText =
    params.role === "teacher"
      ? "docente"
      : "alumno";


  return `<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    Verificación institucional · Enraíza
  </title>
</head>


<body
  style="
    margin:0;
    padding:0;
    background:#f4f1ea;
    font-family:Arial, Helvetica, sans-serif;
    color:#1f2a24;
  "
>

<table
  role="presentation"
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    background:#f4f1ea;
    padding:32px 0;
  "
>

<tr>

<td align="center">


<table
  role="presentation"
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="
    max-width:640px;
    background:#ffffff;
    border:1px solid #dfe6dc;
    border-radius:18px;
    overflow:hidden;
  "
>


<!-- ======================================================
     ENCABEZADO
     ====================================================== -->

<tr>

<td
  style="
    background:
      linear-gradient(
        135deg,
        #2d5b3a 0%,
        #4a7a52 100%
      );

    padding:28px 32px;

    text-align:center;
  "
>

<div
  style="
    font-family:
      Georgia,
      'Times New Roman',
      serif;

    font-size:30px;

    font-weight:700;

    color:#f8f5f0;

    letter-spacing:.5px;
  "
>
  Enraíza
</div>

</td>

</tr>


<!-- ======================================================
     CONTENIDO
     ====================================================== -->

<tr>

<td
  style="
    padding:30px 32px 20px;
  "
>


<div
  style="
    font-size:26px;

    font-weight:700;

    color:#213128;

    margin-bottom:14px;
  "
>
  Verificación institucional
</div>


<div
  style="
    font-size:16px;

    line-height:1.7;

    color:#3c4d42;

    margin-bottom:22px;
  "
>

Recibimos una solicitud para vincular
este correo con tu identidad institucional
de

<strong>
${institution}
</strong>

como

<strong>
${roleText}
</strong>

en Enraíza.

</div>


<!-- ======================================================
     CÓDIGO
     ====================================================== -->

<div
  style="
    text-align:center;
    margin:28px 0;
  "
>

<div
  style="
    display:inline-block;

    min-width:210px;

    background:#f4f1ea;

    border:1px solid #dfe6dc;

    border-radius:16px;

    padding:20px 24px;
  "
>


<div
  style="
    font-size:13px;

    line-height:1.5;

    color:#607268;

    text-transform:uppercase;

    letter-spacing:1.2px;

    margin-bottom:8px;
  "
>
  Tu código
</div>


<div
  style="
    font-family:
      Arial,
      Helvetica,
      sans-serif;

    font-size:36px;

    line-height:1.1;

    font-weight:800;

    letter-spacing:7px;

    color:#2d5b3a;
  "
>
  ${code}
</div>


</div>

</div>


<div
  style="
    font-size:14px;

    line-height:1.7;

    color:#53675d;
  "
>

Introduce este código en Enraíza
para completar la verificación.

El código vence en

<strong>
10 minutos
</strong>

y solo puede utilizarse una vez.

</div>


</td>

</tr>


<!-- ======================================================
     PIE
     ====================================================== -->

<tr>

<td
  style="
    padding:0 32px 28px;
  "
>

<div
  style="
    border-top:
      1px solid #e4e9e1;

    padding-top:18px;

    font-size:13px;

    line-height:1.7;

    color:#607268;
  "
>

Si tú no solicitaste esta verificación,
puedes ignorar este correo.

<br />

<strong>
Enraíza
</strong>

· Por una vida más sostenible,
una raíz a la vez.

</div>

</td>

</tr>


</table>

</td>

</tr>

</table>

</body>
</html>`;
}


/* ============================================================
   ENVÍO MEDIANTE RESEND
   ============================================================ */

async function sendWithResend(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {

  const resendResponse =
    await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${RESEND_API_KEY}`,

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          from: FROM_EMAIL,

          to: [
            params.to,
          ],

          subject:
            params.subject,

          text:
            params.text,

          html:
            params.html,
        }),
      },
    );


  if (!resendResponse.ok) {

    const errorText =
      await resendResponse.text();

    throw new Error(
      `Resend ${resendResponse.status}: ` +
      errorText.slice(0, 1000),
    );
  }
}


/* ============================================================
   TOMAR CORREOS PENDIENTES
   ============================================================ */

async function claimBatchForUser(
  userId: string,
  limit: number,
) {

  const {
    data,
    error,
  } = await admin.rpc(
    "claim_institution_verification_email_for_user",
    {
      p_user_id: userId,
      p_limit: limit,
    },
  );


  if (error) {
    throw error;
  }


  return data ?? [];
}


/* ============================================================
   MARCAR CORREO COMO ENVIADO / FALLIDO
   ============================================================ */

async function completeEmail(
  id: string,
  success: boolean,
  errorMessage?: string,
) {

  const {
    error,
  } = await admin.rpc(
    "complete_institution_verification_email",
    {
      p_id: id,

      p_success:
        success,

      p_error:
        errorMessage ?? null,
    },
  );


  if (error) {

    console.error(
      "No se pudo actualizar la cola de correo",
      {
        id,
        error: error.message,
      },
    );
  }
}


/* ============================================================
   EDGE FUNCTION
   ============================================================ */

Deno.serve(
  async (
    req: Request,
  ): Promise<Response> => {


    /* --------------------------------------------------------
       OPTIONS
       -------------------------------------------------------- */

    if (
      req.method ===
      "OPTIONS"
    ) {

      return new Response(null, { status: 204, headers: corsHeaders });
    }


    /* --------------------------------------------------------
       SOLO POST
       -------------------------------------------------------- */

    if (
      req.method !==
      "POST"
    ) {

      return responseJson(
        {
          ok: false,

          error:
            "Método no permitido. Usa POST.",
        },

        405,
      );
    }


    try {

      /* ------------------------------------------------------
         AUTORIZACIÓN

         Esta función utiliza SERVICE ROLE.

         NUNCA pongas la service role key
         dentro de index.html.
         ------------------------------------------------------ */

      const authHeader =
        req.headers.get(
          "authorization",
        ) ?? "";


      if (
        !authHeader.startsWith(
          "Bearer ",
        )
      ) {

        return responseJson(
          {
            ok: false,

            error:
              "Falta autorización.",
          },

          401,
        );
      }


      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if(!token){
        return responseJson({ ok:false, error:"Autorización inválida." }, 401);
      }

      // El navegador envía el access_token normal del usuario.
      // La SERVICE_ROLE_KEY se queda únicamente en el servidor y se usa
      // con el cliente admin para procesar la cola.
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if(userError || !userData?.user){
        return responseJson({ ok:false, error:"Sesión inválida o expirada." }, 401);
      }


      /* ------------------------------------------------------
         LÍMITE
         ------------------------------------------------------ */

      let limit = 20;


      try {

        const body =
          await req.json();


        if (
          Number.isFinite(
            Number(
              body?.limit,
            ),
          )
        ) {

          limit =
            Math.min(
              100,
              Math.max(
                1,
                Number(
                  body.limit,
                ),
              ),
            );
        }

      } catch {

        // Body vacío.
        // Se mantiene limit = 20.

      }


      /* ------------------------------------------------------
         OBTENER COLA
         ------------------------------------------------------ */

      const rows = await claimBatchForUser(userData.user.id, Math.min(limit, 5));


      let sent = 0;
      let failed = 0;


      /* ------------------------------------------------------
         PROCESAR CADA CORREO
         ------------------------------------------------------ */

      for (
        const row of rows
      ) {

        try {

          const recipient =
            String(
              row.recipient_email ??
              "",
            )
              .trim()
              .toLowerCase();


          const subject =
            String(
              row.subject ??
              "Código de verificación institucional de Enraíza",
            );


          const bodyText =
            String(
              row.body_text ??
              "",
            );


          const role =
            String(
              row.role ??
              "student",
            );


          const code =
            extractCode(
              bodyText,
            );


          if (
            !recipient
          ) {

            throw new Error(
              "La fila no contiene destinatario.",
            );
          }


          if (
            !code
          ) {

            throw new Error(
              "La fila no contiene un código válido de 6 dígitos.",
            );
          }


          const institutionName =
            await getInstitutionName(
              String(
                row.institution_id ??
                "",
              ),
            );


          const html =
            institutionEmailHtml(
              {
                code,

                institutionName,

                role,
              },
            );


          /* --------------------------------------------------
             ENVIAR
             -------------------------------------------------- */

          await sendWithResend(
            {
              to:
                recipient,

              subject:
                subject,

              text:
                bodyText,

              html:
                html,
            },
          );


          /* --------------------------------------------------
             MARCAR CORRECTO
             -------------------------------------------------- */

          await completeEmail(
            row.id,
            true,
          );


          sent++;

        } catch (error) {

          const message =
            error instanceof Error
              ? error.message
              : String(error);


          console.error(
            "Error enviando correo institucional",
            {
              id:
                row.id,

              error:
                message,
            },
          );


          await completeEmail(
            row.id,
            false,
            message,
          );


          failed++;
        }
      }


      /* ------------------------------------------------------
         RESPUESTA
         ------------------------------------------------------ */

      return responseJson(
        {
          ok: true,

          processed:
            rows.length,

          sent,

          failed,
        },
      );


    } catch (error) {

      const message =
        error instanceof Error
          ? error.message
          : String(error);


      console.error(
        "send-institutional-code error:",
        message,
      );


      return responseJson(
        {
          ok: false,

          error:
            message,
        },

        500,
      );
    }
  },
);