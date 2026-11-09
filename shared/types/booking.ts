export type BookingStatus='pending_payment'|'confirmed'|'cancelled'|'expired'|'payment_failed'|'completed'|'no_show'
export type BookingGuestStatus={
  reference:string
  status:BookingStatus
  startsAt:string
  endsAt:string
  staffName:string
  services:Array<{name:string;priceXof:number;durationMinutes:number}>
  totalXof:number
  depositDueXof:number
  amountPaidXof:number
  remainingXof:number
  expiresAt:string|null
  payments:Array<{amountXof:number;status:string;currency:string;paidAt:string|null}>
  salon:{name:string;phone:string|null;whatsapp:string|null;email:string|null}
}
