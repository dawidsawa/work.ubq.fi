import { Env, Context } from "./types";
import { validatePOST } from "./validators";
import { Request } from "@cloudflare/workers-types";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(ctx: Context): Promise<Response> {
  const { request, env } = ctx;

  const url = new URL(request.url);

  try {
    switch (request.method) {
      case "OPTIONS":
        return new Response(null, {
          headers: corsHeaders,
          status: 204,
        });

      case "POST":
        return await handleSet(env, request);

      case "GET":
        if (url.searchParams.has("key")) {
          const key = url.searchParams.get("key") as string;
          return await handleGet(key, env);
        } else {
          return await handleList(env);
        }

      default:
        return new Response("Method Not Allowed", {
          headers: corsHeaders,
          status: 405,
        });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response("Internal Server Error", {
      headers: corsHeaders,
      status: 500,
    });
  }
}

async function handleSet(env: Env, request: Request): Promise<Response> {
  const result = await validatePOST(request);

  if (!result.isValid || !result.gitHubUserId || !result.referralCode) {
    return new Response("Unauthorized", {
      headers: corsHeaders,
      status: 400,
    });
  }

  const { gitHubUserId, referralCode } = result;

  const oldRefCode = await env.KVNamespace.get(gitHubUserId);

  if (oldRefCode) {
    return new Response(`Key '${gitHubUserId}' already has a referral code: '${oldRefCode}'`, {
      headers: corsHeaders,
      status: 404,
    });
  }

  await env.KVNamespace.put(gitHubUserId, referralCode);

  return new Response(`Key '${gitHubUserId}' added with value '${referralCode}'`, {
    headers: corsHeaders,
    status: 200,
  });
}

async function handleGet(gitHubUserId: string, env: Env): Promise<Response> {
  const referralCode = await env.KVNamespace.get(gitHubUserId);
  if (referralCode) {
    return new Response(`Value for '${gitHubUserId}': ${referralCode}`, {
      headers: corsHeaders,
      status: 200,
    });
  } else {
    return new Response(`No value found for '${gitHubUserId}'`, {
      headers: corsHeaders,
      status: 404,
    });
  }
}

async function handleList(env: Env): Promise<Response> {
  const gitHubUsersIds = await env.KVNamespace.list();
  const referrals: Record<string, string | null> = {};

  for (const { name: userId } of gitHubUsersIds.keys) {
    const referralCode = await env.KVNamespace.get(userId);
    referrals[userId] = referralCode;
  }

  return new Response(JSON.stringify(referrals, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
