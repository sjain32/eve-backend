import * as slotsService from "./slots.service.js";

// POST /api/v1/slots/generate
export async function generateSlotsHandler(req, res) {
  const result = await slotsService.generateSlots(req.user.id, req.body);
  res.status(201).json({
    message: result.mode === "auto"
      ? `Auto-generated ${result.created} slots (09:00–18:30, every 30 min)`
      : `Created ${result.created} manual slots`,
    ...result,
  });
}

// GET /api/v1/slots/:centreTestId
// Query params: ?date=YYYY-MM-DD  OR  ?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function listSlotsHandler(req, res) {
  const { date, from, to } = req.query;
  const slots = await slotsService.listSlots(
    req.params.centreTestId,
    req.user.id,
    { date, from, to }
  );
  res.status(200).json({ slots });
}

// DELETE /api/v1/slots
export async function deleteSlotsHandler(req, res) {
  const result = await slotsService.deleteSlots(req.user.id, req.body);
  res.status(200).json({ message: "Slots deleted", ...result });
}
