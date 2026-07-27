"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type EventStatus = "draft" | "on_sale" | "sold_out" | "closed";
type AdmissionType = "general_admission" | "reserved_seating";

type DashboardTicketType = {
  id: string;
  name: string;
  description: string | null;
  admissionType: AdmissionType;
  sectionLabel: string | null;
  rowLabel: string | null;
  seatStartNumber: number | null;
  entranceLabel: string | null;
  accessInstructions: string | null;
  isTransferable: boolean;
  priceUsdc: string;
  quantityTotal: number;
  quantityReserved: number;
  quantitySold: number;
  maxPerOrder: number;
  isActive: boolean;
  salesStartAt: string | null;
  salesEndAt: string | null;
};

export type DashboardEvent = {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  status: EventStatus;
  ticketTypes: DashboardTicketType[];
};

export function ClubDashboardClient({
  clubSlug,
  canManage,
  events,
}: {
  clubSlug: string;
  canManage: boolean;
  events: DashboardEvent[];
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Inventory</p>
          <h2 className="mt-1 text-2xl font-semibold">Events and ticket types</h2>
        </div>
      </div>

      {canManage && <CreateEventForm clubSlug={clubSlug} />}

      <div className="mt-6 space-y-5">
        {events.map((event) => (
          <EventPanel
            key={event.id}
            event={event}
            clubSlug={clubSlug}
            canManage={canManage}
          />
        ))}
        {events.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-zinc-500">
            No events yet. Create the first matchday above.
          </div>
        )}
      </div>
    </div>
  );
}

function CreateEventForm({ clubSlug }: { clubSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestJson(`/api/club/${clubSlug}/events`, "POST", {
        name,
        venue,
        startsAt: new Date(startsAt).toISOString(),
      });
      setName("");
      setVenue("");
      setStartsAt("");
      setOpen(false);
      router.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 rounded-xl gradient-accent px-4 py-2.5 text-sm font-medium text-zinc-950"
      >
        Create event
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 rounded-2xl border border-border bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Event name">
          <input required minLength={3} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Venue">
          <input required minLength={2} value={venue} onChange={(e) => setVenue(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Starts at">
          <input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button disabled={submitting} className="rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">
          {submitting ? "Creating…" : "Create draft"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm text-zinc-300">
          Cancel
        </button>
      </div>
    </form>
  );
}

function EventPanel({
  event,
  clubSlug,
  canManage,
}: {
  event: DashboardEvent;
  clubSlug: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(event.status);
  const [statusBusy, setStatusBusy] = useState(false);
  const [addingTicket, setAddingTicket] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(nextStatus: EventStatus) {
    setStatusBusy(true);
    setError(null);
    try {
      await requestJson(`/api/club/${clubSlug}/events/${event.id}`, "PATCH", {
        status: nextStatus,
      });
      setStatus(nextStatus);
      router.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-medium">{event.name}</h3>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
              {status.replace("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {event.venue} · {new Date(event.startsAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status === "on_sale" && (
            <Link href={`/events/${event.id}`} className="text-xs text-cyan-400 hover:underline">
              Public page ↗
            </Link>
          )}
          {canManage && (
            <select
              aria-label={`Status for ${event.name}`}
              value={status}
              disabled={statusBusy}
              onChange={(e) => void changeStatus(e.target.value as EventStatus)}
              className="rounded-xl border border-border bg-surface-elev px-3 py-2 text-xs uppercase text-zinc-200"
            >
              <option value="draft">Draft</option>
              <option value="on_sale">On sale</option>
              <option value="sold_out">Sold out</option>
              <option value="closed">Closed</option>
            </select>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="space-y-3">
          {event.ticketTypes.map((ticketType) => (
            <TicketTypeRow
              key={ticketType.id}
              clubSlug={clubSlug}
              ticketType={ticketType}
              canManage={canManage}
            />
          ))}
          {event.ticketTypes.length === 0 && (
            <p className="text-sm text-zinc-500">No ticket types configured.</p>
          )}
        </div>

        {canManage && (
          <div className="mt-4">
            {addingTicket ? (
              <TicketTypeForm
                clubSlug={clubSlug}
                eventId={event.id}
                onDone={() => setAddingTicket(false)}
              />
            ) : (
              <button type="button" onClick={() => setAddingTicket(true)} className="text-sm text-cyan-400 hover:underline">
                + Add ticket type
              </button>
            )}
          </div>
        )}
        {(error || !canManage) && (
          <p className={`mt-3 text-sm ${error ? "text-red-400" : "text-zinc-500"}`}>
            {error ?? "Your role has read-only access to event inventory."}
          </p>
        )}
      </div>
    </article>
  );
}

function TicketTypeRow({
  clubSlug,
  ticketType,
  canManage,
}: {
  clubSlug: string;
  ticketType: DashboardTicketType;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const available = ticketType.quantityTotal - ticketType.quantityReserved - ticketType.quantitySold;

  if (editing) {
    return (
      <TicketTypeForm
        clubSlug={clubSlug}
        ticketType={ticketType}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface-elev p-4 sm:flex-row sm:items-center">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium">{ticketType.name}</p>
          <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] uppercase text-cyan-300">
            {ticketType.admissionType === "reserved_seating" ? "reserved seats" : "general admission"}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${ticketType.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700 text-zinc-400"}`}>
            {ticketType.isActive ? "available" : "hidden"}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {available} available · {ticketType.quantityReserved} reserved · {ticketType.quantitySold} sold · max {ticketType.maxPerOrder}/order
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {ticketType.admissionType === "reserved_seating"
            ? `${ticketType.sectionLabel} · row ${ticketType.rowLabel} · seats from ${ticketType.seatStartNumber}`
            : ticketType.sectionLabel
              ? `${ticketType.sectionLabel} · unassigned seating`
              : "Unassigned seating"}
          {ticketType.entranceLabel ? ` · enter ${ticketType.entranceLabel}` : ""}
          {ticketType.isTransferable ? " · transfer eligible" : ""}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <p className="font-mono text-lg">{ticketType.priceUsdc} USDC</p>
        {canManage && (
          <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function TicketTypeForm({
  clubSlug,
  eventId,
  ticketType,
  onDone,
}: {
  clubSlug: string;
  eventId?: string;
  ticketType?: DashboardTicketType;
  onDone: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(ticketType?.name ?? "");
  const [description, setDescription] = useState(ticketType?.description ?? "");
  const [admissionType, setAdmissionType] = useState<AdmissionType>(
    ticketType?.admissionType ?? "general_admission",
  );
  const [sectionLabel, setSectionLabel] = useState(ticketType?.sectionLabel ?? "");
  const [rowLabel, setRowLabel] = useState(ticketType?.rowLabel ?? "");
  const [seatStartNumber, setSeatStartNumber] = useState(
    ticketType?.seatStartNumber ? String(ticketType.seatStartNumber) : "1",
  );
  const [entranceLabel, setEntranceLabel] = useState(ticketType?.entranceLabel ?? "");
  const [accessInstructions, setAccessInstructions] = useState(ticketType?.accessInstructions ?? "");
  const [isTransferable, setIsTransferable] = useState(ticketType?.isTransferable ?? false);
  const [priceUsdc, setPriceUsdc] = useState(ticketType?.priceUsdc ?? "");
  const [quantityTotal, setQuantityTotal] = useState(String(ticketType?.quantityTotal ?? ""));
  const [maxPerOrder, setMaxPerOrder] = useState(String(ticketType?.maxPerOrder ?? 8));
  const [isActive, setIsActive] = useState(ticketType?.isActive ?? true);
  const [salesStartAt, setSalesStartAt] = useState(toLocalDateTime(ticketType?.salesStartAt));
  const [salesEndAt, setSalesEndAt] = useState(toLocalDateTime(ticketType?.salesEndAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const body = {
      name,
      description: description.trim() || null,
      admissionType,
      sectionLabel: sectionLabel.trim() || null,
      rowLabel: admissionType === "reserved_seating" ? rowLabel.trim() || null : null,
      seatStartNumber:
        admissionType === "reserved_seating" ? Number(seatStartNumber) : null,
      entranceLabel: entranceLabel.trim() || null,
      accessInstructions: accessInstructions.trim() || null,
      isTransferable,
      priceUsdc,
      quantityTotal: Number(quantityTotal),
      maxPerOrder: Number(maxPerOrder),
      isActive,
      salesStartAt: salesStartAt ? new Date(salesStartAt).toISOString() : null,
      salesEndAt: salesEndAt ? new Date(salesEndAt).toISOString() : null,
    };

    try {
      if (ticketType) {
        await requestJson(`/api/club/${clubSlug}/ticket-types/${ticketType.id}`, "PATCH", body);
      } else {
        await requestJson(`/api/club/${clubSlug}/events/${eventId}/ticket-types`, "POST", body);
      }
      onDone();
      router.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-cyan-900/60 bg-zinc-950/40 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Ticket name">
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Admission">
          <select
            value={admissionType}
            disabled={Boolean(ticketType)}
            onChange={(e) => setAdmissionType(e.target.value as AdmissionType)}
            className={inputClass}
          >
            <option value="general_admission">General admission</option>
            <option value="reserved_seating">Reserved seating</option>
          </select>
        </Field>
        <Field label="Price (USDC)">
          <input required inputMode="decimal" value={priceUsdc} onChange={(e) => setPriceUsdc(e.target.value)} placeholder="25.00" className={inputClass} />
        </Field>
        <Field label={admissionType === "reserved_seating" ? "Seats to publish" : "Total quantity"}>
          <input required type="number" min={1} max={admissionType === "reserved_seating" ? 10_000 : 1_000_000} value={quantityTotal} onChange={(e) => setQuantityTotal(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Maximum per order">
          <input required type="number" min={1} max={50} value={maxPerOrder} onChange={(e) => setMaxPerOrder(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Sales start (optional)">
          <input type="datetime-local" value={salesStartAt} onChange={(e) => setSalesStartAt(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Sales end (optional)">
          <input type="datetime-local" value={salesEndAt} onChange={(e) => setSalesEndAt(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Description (optional)" className="sm:col-span-2">
          <input maxLength={240} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </Field>
        <Field label={admissionType === "reserved_seating" ? "Section" : "Area / stand (optional)"}>
          <input value={sectionLabel} onChange={(e) => setSectionLabel(e.target.value)} className={inputClass} />
        </Field>
        {admissionType === "reserved_seating" && (
          <>
            <Field label="Row">
              <input required value={rowLabel} onChange={(e) => setRowLabel(e.target.value)} className={inputClass} />
            </Field>
            <Field label="First seat number">
              <input required type="number" min={1} value={seatStartNumber} onChange={(e) => setSeatStartNumber(e.target.value)} className={inputClass} />
            </Field>
          </>
        )}
        <Field label="Entrance / gate (optional)">
          <input value={entranceLabel} onChange={(e) => setEntranceLabel(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Entry instructions (optional)" className="sm:col-span-2">
          <input maxLength={500} value={accessInstructions} onChange={(e) => setAccessInstructions(e.target.value)} placeholder="Bring photo ID. Gates open 90 minutes before kick-off." className={inputClass} />
        </Field>
      </div>
      {admissionType === "reserved_seating" && (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Seats are created sequentially for this row and automatically assigned during checkout. Create a separate ticket type for each priced row or section.
        </p>
      )}
      <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-emerald-400" />
        Available for sale when the event is on sale
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
        <input type="checkbox" checked={isTransferable} onChange={(e) => setIsTransferable(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
        Eligible for controlled transfer when the marketplace launches
      </label>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button disabled={submitting} className="rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">
          {submitting ? "Saving…" : ticketType ? "Save ticket type" : "Add ticket type"}
        </button>
        <button type="button" onClick={onDone} className="rounded-xl border border-border px-4 py-2 text-sm text-zinc-300">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-xs uppercase tracking-wide text-zinc-500 ${className}`}>
      {label}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

async function requestJson(url: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `request_failed_${response.status}`);
  }
  return data;
}

function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong. Try again.";
  const messages: Record<string, string> = {
    active_ticket_type_required: "Add at least one available ticket type before publishing this event.",
    quantity_below_committed_inventory: "Total quantity cannot be lower than tickets already reserved or sold.",
    invalid_sales_window: "The sales end must be after the sales start.",
    admission_type_locked: "Admission type cannot change after this ticket type is created.",
    seat_inventory_locked: "Seat layout cannot change after seats have been reserved or sold.",
    reserved_seat_configuration_required: "Reserved seating needs a section, row, and first seat number.",
    invalid_body: "Check the form values and try again.",
  };
  return messages[error.message] ?? error.message.replaceAll("_", " ");
}

function toLocalDateTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface-elev px-3 py-2.5 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-cyan-700";
