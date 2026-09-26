import * as discoveryService from "./discovery.service.js";
import { parsePagination } from "../../utils/paginate.js";

// GET /api/v1/discover/centres?name=&location=&page=&limit=
export async function listCentresHandler(req, res) {
  const { name, location } = req.query;
  const pagination = parsePagination(req.query);
  const result = await discoveryService.listCentres({ name, location, ...pagination });
  res.status(200).json(result);
}

// GET /api/v1/discover/centres/:centreId
export async function getCentreHandler(req, res) {
  const centre = await discoveryService.getCentreWithTests(req.params.centreId);
  res.status(200).json({ centre });
}

// GET /api/v1/discover/slots/:centreTestId?date= OR ?from=&to=
export async function getAvailableSlotsHandler(req, res) {
  const { date, from, to } = req.query;
  const result = await discoveryService.getAvailableSlots(
    req.params.centreTestId,
    { date, from, to }
  );
  res.status(200).json(result);
}
