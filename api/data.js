import { kv } from "@vercel/kv";

export default async function handler(request, response) {
  console.log("request receieved");
  if (request.method?.toLowerCase() == "post") {
    return postHandler(request, response);
  }

  return getHandler(request, response);
}

async function getHandler(request, response) {
  const id = request.query.id;
  const data = await kv.get(id);
  if (data) return response.status(200).json(data);

  return response.status(404).json("Not found");
}

async function postHandler(request, response) {
  const id = request.query.id;
  const data = request.body;
  if (!data) return response.status(400).json("Bad Request");

  await kv.set(id, data);
  
  return response.status(200).json("OK");
}
