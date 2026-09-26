import * as centresService from "./centres.service.js";
import { parsePagination } from "../../utils/paginate.js";

// POST /api/v1/centres
export async function createCentreHandler(req, res) {
  const centre = await centresService.createCentre(req.user.id, req.body);
  res.status(201).json({ message: "Diagnostic centre created", centre });
}

// GET /api/v1/centres/my?page=&limit=
export async function getMyCentresHandler(req, res) {
  const pagination = parsePagination(req.query);
  const result = await centresService.getMyCentres(req.user.id, pagination);
  res.status(200).json(result);
}

// GET /api/v1/centres/:centreId
export async function getCentreHandler(req, res) {
  const centre = await centresService.getCentreById(req.params.centreId, req.user.id);
  res.status(200).json({ centre });
}

// PATCH /api/v1/centres/:centreId
export async function updateCentreHandler(req, res) {
  const centre = await centresService.updateCentre(req.params.centreId, req.user.id, req.body);
  res.status(200).json({ message: "Centre updated", centre });
}

// GET /api/v1/centres/bookings/all?page=&limit=
export async function getAllBookingsHandler(req, res) {
  const pagination = parsePagination(req.query);
  const result = await centresService.getBookingsForMyCentres(req.user.id, pagination);
  res.status(200).json(result);
}

// GET /api/v1/centres/:centreId/bookings?page=&limit=
export async function getCentreBookingsHandler(req, res) {
  const pagination = parsePagination(req.query);
  const result = await centresService.getBookingsForCentre(req.params.centreId, req.user.id, pagination);
  res.status(200).json(result);
}
