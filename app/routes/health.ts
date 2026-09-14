export async function loader() {
  return Response.json({
    status: "ok",
    service: "cro-partner",
    timestamp: new Date().toISOString(),
  });
}
