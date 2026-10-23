-- The dancer portal was removed from the app. Its functions are no longer called, so signed-in users no longer
-- need to run them. The tables and functions stay (nothing is dropped); only the signed-in grant is removed.
REVOKE EXECUTE ON FUNCTION
  public.create_member_invite(uuid, integer, text, text),
  public.redeem_member_invite(text, text),
  public.member_studios(),
  public.member_view(uuid),
  public.member_claims(uuid),
  public.submit_payment_claim_member(uuid, uuid, bigint, text, date, text)
FROM authenticated;
