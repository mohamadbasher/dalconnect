import { supabase } from "./supabase";

/**
 * Find or create the conversation between a customer and a professional.
 * Returns the conversation id — navigate with router.push(`/chat/${id}`).
 */
export async function getOrCreateConversation(customerId: string, professionalId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("customer_id", customerId)
    .eq("professional_id", professionalId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ customer_id: customerId, professional_id: professionalId })
    .select("id")
    .single();
  if (error) {
    // race: another client created it between select and insert
    const { data: retry } = await supabase
      .from("conversations")
      .select("id")
      .eq("customer_id", customerId)
      .eq("professional_id", professionalId)
      .maybeSingle();
    if (retry?.id) return retry.id;
    throw error;
  }
  return data.id;
}
