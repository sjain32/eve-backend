import * as bookingsService from "./bookings.service.js";
import { parsePagination } from "../../utils/paginate.js";

// POST /api/v1/bookings
export async function createBookingHandler(req, res) {
  const booking = await bookingsService.createBooking(req.user.id, req.body);
  res.status(201).json({ message: "Booking created successfully", booking });
}

// GET /api/v1/bookings?page=&limit=
export async function getMyBookingsHandler(req, res) {
  const pagination = parsePagination(req.query);
  const result = await bookingsService.getMyBookings(req.user.id, pagination);
  res.status(200).json(result);
}

// GET /api/v1/bookings/:bookingId
export async function getBookingHandler(req, res) {
  const booking = await bookingsService.getBookingById(req.params.bookingId, req.user.id);
  res.status(200).json({ booking });
}

// PATCH /api/v1/bookings/:bookingId/cancel
export async function cancelBookingHandler(req, res) {
  const booking = await bookingsService.cancelBooking(req.params.bookingId, req.user.id);
  res.status(200).json({ message: "Booking cancelled successfully", booking });
}
