"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type EventStatus = "draft" | "on_sale" | "sold_out" | "closed" | "cancelled";
type LifecycleAction = "publish" | "unpublish" | "close" | "cancel" | "archive" | "unarchive";
type AdmissionType = "general_admission" | "reserved_seating";

type DashboardTicketType = {
  id: string;
  name: string;
  description: string | null;
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

type DashboardTicketArea = {
  id: string;
  name: string;
  admissionType: AdmissionType;
  sectionLabel: string | null;
  rowLabel: string | null;
  seatStartNumber: number | null;
  entranceLabel: string | null;
  accessInstructions: string | null;
  quantityTotal: number;
  quantityReserved: number;
  quantitySold: number;
  maxPerOrder: number;
  isActive: boolean;
  ticketTypes: DashboardTicketType[];
};

export type DashboardEvent = {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  status: EventStatus;
  archivedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  orderCount: number;
  refundPendingCount: number;
  ticketAreas: DashboardTicketArea[];
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
  const activeEvents = events.filter((event) => !event.archivedAt);
  const archivedEvents = events.filter((event) => event.archivedAt);
  return (
    <div>
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Inventory</p>
        <h2 className="mt-1 text-2xl font-semibold">Matchdays, areas, and ticket categories</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
          Seating areas hold the physical inventory. Ticket categories—Adult, Junior, Senior, and so on—are priced separately within each area.
        </p>
      </div>
      {canManage && <CreateEventForm clubSlug={clubSlug} />}
      <div className="mt-6 space-y-5">
        {activeEvents.map((event) => (
          <EventPanel key={event.id} event={event} clubSlug={clubSlug} canManage={canManage} />
        ))}
        {activeEvents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-zinc-500">
            No events yet. Create the first matchday above.
          </div>
        )}
      </div>
      {archivedEvents.length > 0 && (
        <details className="mt-8 rounded-2xl border border-border bg-surface/50 p-5">
          <summary className="cursor-pointer text-sm font-medium text-zinc-300">
            Archived events ({archivedEvents.length})
          </summary>
          <div className="mt-5 space-y-5">
            {archivedEvents.map((event) => (
              <EventPanel key={event.id} event={event} clubSlug={clubSlug} canManage={canManage} />
            ))}
          </div>
        </details>
      )}
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
    return <button type="button" onClick={() => setOpen(true)} className="mt-5 rounded-xl gradient-accent px-4 py-2.5 text-sm font-medium text-zinc-950">Create event</button>;
  }
  return (
    <form onSubmit={submit} className="mt-5 rounded-2xl border border-border bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Event name"><input required minLength={3} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></Field>
        <Field label="Venue"><input required minLength={2} value={venue} onChange={(event) => setVenue(event.target.value)} className={inputClass} /></Field>
        <Field label="Starts at"><input required type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={inputClass} /></Field>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex gap-3"><button disabled={submitting} className="rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">{submitting ? "Creating…" : "Create draft"}</button><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm text-zinc-300">Cancel</button></div>
    </form>
  );
}

function EventPanel({ event, clubSlug, canManage }: { event: DashboardEvent; clubSlug: string; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [addingArea, setAddingArea] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archived = Boolean(event.archivedAt);
  async function lifecycle(action: LifecycleAction) {
    let body: { action: LifecycleAction; reason?: string } = { action };
    if (action === "cancel") {
      const reason = window.prompt("Why is this event being cancelled?");
      if (reason === null) return;
      if (reason.trim().length < 5) return setError("Enter a cancellation reason of at least 5 characters.");
      if (!window.confirm("Cancel this event, void issued tickets, and queue paid orders for refunds?")) return;
      body = { action, reason: reason.trim() };
    }
    setBusy(true); setError(null);
    try { await requestJson(`/api/club/${clubSlug}/events/${event.id}`, "PATCH", body); router.refresh(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }
  async function deleteDraft() {
    if (!window.confirm(`Permanently delete the unused draft “${event.name}”?`)) return;
    setBusy(true); setError(null);
    try { await requestJson(`/api/club/${clubSlug}/events/${event.id}`, "DELETE"); router.refresh(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setBusy(false); }
  }
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-medium">{event.name}</h3><StatusPill>{event.status.replace("_", " ")}</StatusPill>{archived && <StatusPill tone="violet">archived</StatusPill>}</div><p className="mt-1 text-sm text-zinc-500">{event.venue} · {new Date(event.startsAt).toLocaleString()}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {event.status === "on_sale" && <Link href={`/events/${event.id}`} className="text-xs text-cyan-400 hover:underline">Public page ↗</Link>}
          {canManage && (archived ? <ActionButton disabled={busy} onClick={() => void lifecycle("unarchive")}>Restore</ActionButton> : <>
            {(event.status === "draft" || event.status === "closed") && <ActionButton disabled={busy} onClick={() => void lifecycle("publish")}>{event.status === "closed" ? "Reopen sales" : "Publish"}</ActionButton>}
            {(event.status === "on_sale" || event.status === "sold_out") && <><ActionButton disabled={busy || event.orderCount > 0} title={event.orderCount > 0 ? "Events with orders must be closed, not unpublished." : undefined} onClick={() => void lifecycle("unpublish")}>Unpublish</ActionButton><ActionButton disabled={busy} onClick={() => void lifecycle("close")}>Close sales</ActionButton><ActionButton disabled={busy} onClick={() => void lifecycle("cancel")}>Cancel</ActionButton></>}
            {(event.status === "closed" || event.status === "cancelled") && <ActionButton disabled={busy} onClick={() => void lifecycle("archive")}>Archive</ActionButton>}
            {event.status === "draft" && event.orderCount === 0 && <ActionButton disabled={busy} onClick={() => void deleteDraft()}>Delete draft</ActionButton>}
          </>)}
        </div>
      </div>
      <div className="p-5">
        {event.status === "cancelled" && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">Cancelled{event.cancellationReason ? `: ${event.cancellationReason}` : ""}{event.refundPendingCount > 0 ? ` · ${event.refundPendingCount} refund(s) pending` : ""}</p>}
        <div className="space-y-3">
          {event.ticketAreas.map((area) => <TicketAreaPanel key={area.id} area={area} eventId={event.id} clubSlug={clubSlug} canManage={canManage} />)}
          {event.ticketAreas.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-zinc-500">Add a seating area or general-admission area, then add Adult, Junior, or other ticket categories.</p>}
        </div>
        {canManage && !archived && (addingArea ? <TicketAreaForm clubSlug={clubSlug} eventId={event.id} onDone={() => { setAddingArea(false); router.refresh(); }} /> : <button type="button" onClick={() => setAddingArea(true)} className="mt-4 rounded-xl border border-cyan-700/70 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-950/30">Add seating area</button>)}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </article>
  );
}

function TicketAreaPanel({ area, eventId, clubSlug, canManage }: { area: DashboardTicketArea; eventId: string; clubSlug: string; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const available = area.quantityTotal - area.quantityReserved - area.quantitySold;
  return <section className="rounded-xl border border-border bg-zinc-950/25 p-4">
    {editing ? <TicketAreaForm clubSlug={clubSlug} eventId={eventId} area={area} onDone={() => { setEditing(false); router.refresh(); }} /> : <>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-medium">{area.name}</h4><StatusPill tone={area.isActive ? "green" : "zinc"}>{area.isActive ? "available" : "hidden"}</StatusPill><StatusPill>{area.admissionType === "reserved_seating" ? "reserved seating" : "general admission"}</StatusPill></div><p className="mt-1 text-xs leading-5 text-zinc-500">{area.admissionType === "reserved_seating" ? `${area.sectionLabel} · Row ${area.rowLabel} · seats from ${area.seatStartNumber}` : area.sectionLabel ?? "Unassigned entry"}{area.entranceLabel ? ` · enter ${area.entranceLabel}` : ""}</p><p className="mt-1 text-xs text-zinc-500">{available} available · {area.quantityReserved} held · {area.quantitySold} sold · max {area.maxPerOrder}/order</p></div>{canManage && <button type="button" onClick={() => setEditing(true)} className="self-start text-xs text-cyan-300 hover:underline">Edit area</button>}</div>
      <div className="mt-4 space-y-2 border-t border-border pt-3">{area.ticketTypes.map((ticketType) => <TicketCategoryRow key={ticketType.id} ticketType={ticketType} area={area} clubSlug={clubSlug} />)}{area.ticketTypes.length === 0 && <p className="text-xs text-amber-200">No purchasable ticket categories yet.</p>}</div>
      {canManage && (addingCategory ? <TicketCategoryForm area={area} eventId={eventId} clubSlug={clubSlug} onDone={() => { setAddingCategory(false); router.refresh(); }} /> : <button type="button" onClick={() => setAddingCategory(true)} className="mt-4 text-xs text-cyan-300 hover:underline">+ Add ticket category</button>)}
    </>}
  </section>;
}

function TicketAreaForm({ clubSlug, eventId, area, onDone }: { clubSlug: string; eventId: string; area?: DashboardTicketArea; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(area?.name ?? "");
  const [admissionType, setAdmissionType] = useState<AdmissionType>(area?.admissionType ?? "general_admission");
  const [sectionLabel, setSectionLabel] = useState(area?.sectionLabel ?? "");
  const [rowLabel, setRowLabel] = useState(area?.rowLabel ?? "");
  const [seatStartNumber, setSeatStartNumber] = useState(String(area?.seatStartNumber ?? 1));
  const [entranceLabel, setEntranceLabel] = useState(area?.entranceLabel ?? "");
  const [accessInstructions, setAccessInstructions] = useState(area?.accessInstructions ?? "");
  const [quantityTotal, setQuantityTotal] = useState(String(area?.quantityTotal ?? ""));
  const [maxPerOrder, setMaxPerOrder] = useState(String(area?.maxPerOrder ?? 8));
  const [isActive, setIsActive] = useState(area?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSubmitting(true); setError(null);
    const body = { name, admissionType, sectionLabel: sectionLabel.trim() || null, rowLabel: admissionType === "reserved_seating" ? rowLabel.trim() || null : null, seatStartNumber: admissionType === "reserved_seating" ? Number(seatStartNumber) : null, entranceLabel: entranceLabel.trim() || null, accessInstructions: accessInstructions.trim() || null, quantityTotal: Number(quantityTotal), maxPerOrder: Number(maxPerOrder), isActive };
    try { if (area) await requestJson(`/api/club/${clubSlug}/ticket-areas/${area.id}`, "PATCH", body); else await requestJson(`/api/club/${clubSlug}/events/${eventId}/ticket-areas`, "POST", body); onDone(); router.refresh(); }
    catch (requestError) { setError(errorMessage(requestError)); }
    finally { setSubmitting(false); }
  }
  return <form onSubmit={submit} className="rounded-xl border border-cyan-900/60 bg-zinc-950/40 p-4"><p className="mb-4 text-sm font-medium text-zinc-200">{area ? "Edit seating area" : "New seating area"}</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Area name"><input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="West Stand · Block W12" className={inputClass} /></Field><Field label="Admission"><select value={admissionType} disabled={Boolean(area)} onChange={(event) => setAdmissionType(event.target.value as AdmissionType)} className={inputClass}><option value="general_admission">General admission</option><option value="reserved_seating">Reserved seating</option></select></Field><Field label={admissionType === "reserved_seating" ? "Seats to publish" : "Total capacity"}><input required type="number" min={1} max={admissionType === "reserved_seating" ? 10_000 : 1_000_000} value={quantityTotal} onChange={(event) => setQuantityTotal(event.target.value)} className={inputClass} /></Field><Field label="Maximum per order"><input required type="number" min={1} max={50} value={maxPerOrder} onChange={(event) => setMaxPerOrder(event.target.value)} className={inputClass} /></Field><Field label={admissionType === "reserved_seating" ? "Section" : "Area / stand (optional)"}><input value={sectionLabel} onChange={(event) => setSectionLabel(event.target.value)} className={inputClass} /></Field>{admissionType === "reserved_seating" && <><Field label="Row"><input required value={rowLabel} onChange={(event) => setRowLabel(event.target.value)} className={inputClass} /></Field><Field label="First seat number"><input required type="number" min={1} value={seatStartNumber} onChange={(event) => setSeatStartNumber(event.target.value)} className={inputClass} /></Field></>}<Field label="Entrance / gate (optional)"><input value={entranceLabel} onChange={(event) => setEntranceLabel(event.target.value)} className={inputClass} /></Field><Field label="Entry instructions (optional)" className="sm:col-span-2"><input maxLength={500} value={accessInstructions} onChange={(event) => setAccessInstructions(event.target.value)} placeholder="Gates open 90 minutes before kick-off." className={inputClass} /></Field></div>{admissionType === "reserved_seating" && <p className="mt-3 text-xs text-zinc-500">Fans receive adjacent best-available seats from this row. Add a separate area for every row or block.</p>}<label className="mt-4 flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 accent-emerald-400" />Available for sale</label>{error && <p className="mt-3 text-sm text-red-400">{error}</p>}<div className="mt-4 flex gap-3"><button disabled={submitting} className="rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">{submitting ? "Saving…" : area ? "Save area" : "Add area"}</button><button type="button" onClick={onDone} className="rounded-xl border border-border px-4 py-2 text-sm text-zinc-300">Cancel</button></div></form>;
}

function TicketCategoryRow({ ticketType, area, clubSlug }: { ticketType: DashboardTicketType; area: DashboardTicketArea; clubSlug: string }) {
  const router = useRouter(); const [editing, setEditing] = useState(false); const available = ticketType.quantityTotal - ticketType.quantityReserved - ticketType.quantitySold;
  return editing ? <TicketCategoryForm area={area} clubSlug={clubSlug} ticketType={ticketType} onDone={() => { setEditing(false); router.refresh(); }} /> : <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-elev/60 px-3 py-3"><div><p className="font-medium text-sm">{ticketType.name} <span className="ml-1 font-mono text-cyan-200">{ticketType.priceUsdc} USDC</span></p>{ticketType.description && <p className="mt-1 text-xs text-zinc-500">{ticketType.description}</p>}<p className="mt-1 text-xs text-zinc-500">{available} category capacity · {ticketType.quantityReserved} held · {ticketType.quantitySold} sold · max {ticketType.maxPerOrder}/order{ticketType.isTransferable ? " · transferable" : ""}</p></div><button type="button" onClick={() => setEditing(true)} className="text-xs text-cyan-300 hover:underline">Edit</button></div>;
}

function TicketCategoryForm({ area, eventId, clubSlug, ticketType, onDone }: { area: DashboardTicketArea; eventId?: string; clubSlug: string; ticketType?: DashboardTicketType; onDone: () => void }) {
  const router = useRouter(); const [name, setName] = useState(ticketType?.name ?? ""); const [description, setDescription] = useState(ticketType?.description ?? ""); const [priceUsdc, setPriceUsdc] = useState(ticketType?.priceUsdc ?? ""); const [quantityTotal, setQuantityTotal] = useState(String(ticketType?.quantityTotal ?? area.quantityTotal)); const [maxPerOrder, setMaxPerOrder] = useState(String(ticketType?.maxPerOrder ?? area.maxPerOrder)); const [isActive, setIsActive] = useState(ticketType?.isActive ?? true); const [isTransferable, setIsTransferable] = useState(ticketType?.isTransferable ?? false); const [salesStartAt, setSalesStartAt] = useState(toLocalDateTime(ticketType?.salesStartAt)); const [salesEndAt, setSalesEndAt] = useState(toLocalDateTime(ticketType?.salesEndAt)); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSubmitting(true); setError(null); const body = { ticketAreaId: area.id, name, description: description.trim() || null, priceUsdc, quantityTotal: Number(quantityTotal), maxPerOrder: Number(maxPerOrder), isActive, isTransferable, salesStartAt: salesStartAt ? new Date(salesStartAt).toISOString() : null, salesEndAt: salesEndAt ? new Date(salesEndAt).toISOString() : null }; try { if (ticketType) await requestJson(`/api/club/${clubSlug}/ticket-types/${ticketType.id}`, "PATCH", body); else await requestJson(`/api/club/${clubSlug}/events/${eventId}/ticket-types`, "POST", body); onDone(); router.refresh(); } catch (requestError) { setError(errorMessage(requestError)); } finally { setSubmitting(false); } }
  return <form onSubmit={submit} className="mt-3 rounded-xl border border-cyan-900/60 bg-zinc-950/40 p-4"><p className="mb-3 text-sm font-medium">{ticketType ? `Edit ${ticketType.name}` : `New category in ${area.name}`}</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Ticket category"><input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} placeholder="Adult" className={inputClass} /></Field><Field label="Price (USDC)"><input required inputMode="decimal" value={priceUsdc} onChange={(event) => setPriceUsdc(event.target.value)} placeholder="25.00" className={inputClass} /></Field><Field label="Category limit"><input required type="number" min={1} max={area.quantityTotal} value={quantityTotal} onChange={(event) => setQuantityTotal(event.target.value)} className={inputClass} /></Field><Field label="Maximum per order"><input required type="number" min={1} max={50} value={maxPerOrder} onChange={(event) => setMaxPerOrder(event.target.value)} className={inputClass} /></Field><Field label="Sales start (optional)"><input type="datetime-local" value={salesStartAt} onChange={(event) => setSalesStartAt(event.target.value)} className={inputClass} /></Field><Field label="Sales end (optional)"><input type="datetime-local" value={salesEndAt} onChange={(event) => setSalesEndAt(event.target.value)} className={inputClass} /></Field><Field label="Description / eligibility" className="sm:col-span-2"><input maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Valid for supporters aged 16 and over." className={inputClass} /></Field></div><label className="mt-4 flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 accent-emerald-400" />Available for sale</label><label className="mt-3 flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={isTransferable} onChange={(event) => setIsTransferable(event.target.checked)} className="h-4 w-4 accent-cyan-400" />Eligible for controlled transfer when the marketplace launches</label>{error && <p className="mt-3 text-sm text-red-400">{error}</p>}<div className="mt-4 flex gap-3"><button disabled={submitting} className="rounded-xl gradient-accent px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">{submitting ? "Saving…" : ticketType ? "Save category" : "Add category"}</button><button type="button" onClick={onDone} className="rounded-xl border border-border px-4 py-2 text-sm text-zinc-300">Cancel</button></div></form>;
}

function StatusPill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "green" | "violet" }) { const colors = { zinc: "bg-zinc-800 text-zinc-400", green: "bg-emerald-500/15 text-emerald-400", violet: "bg-violet-500/15 text-violet-300" }; return <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${colors[tone]}`}>{children}</span>; }
function ActionButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-50">{children}</button>; }
function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) { return <label className={`block text-xs uppercase tracking-wide text-zinc-500 ${className}`}>{label}<span className="mt-2 block">{children}</span></label>; }
async function requestJson(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) { const response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : `request_failed_${response.status}`); return data; }
function errorMessage(error: unknown): string { if (!(error instanceof Error)) return "Something went wrong. Try again."; const messages: Record<string, string> = { active_ticket_type_required: "Add an active ticket category to an active area before publishing.", quantity_below_committed_inventory: "Capacity cannot be lower than tickets already held or sold.", invalid_sales_window: "The sales end must be after the sales start.", admission_type_locked: "Admission type cannot change after this area is created.", seat_inventory_locked: "Seat layout cannot change after seats are held or sold.", reserved_seat_configuration_required: "Reserved seating needs a section, row, and first seat number.", ticket_area_invalid: "Choose a valid seating area for this event.", ticket_area_locked: "A ticket category cannot move after it is created.", only_unused_drafts_can_be_deleted: "Only unused draft events can be permanently deleted.", event_has_commerce_history: "This event has order or ticket history and must be retained.", event_is_not_published: "Only a published event can be unpublished.", listed_event_has_order_history: "This event has order history. Close or cancel it instead.", cancelled_event_is_terminal: "A cancelled event cannot be reopened or published.", close_or_cancel_before_archiving: "Close or cancel this event before archiving it.", inventory_release_invariant_failed: "Ticket inventory could not be released safely. No changes were saved.", invalid_body: "Check the form values and try again." }; return messages[error.message] ?? error.message.replaceAll("_", " "); }
function toLocalDateTime(value?: string | null): string { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
const inputClass = "w-full rounded-xl border border-border bg-surface-elev px-3 py-2.5 text-sm normal-case tracking-normal text-zinc-100 outline-none focus:border-cyan-700";
