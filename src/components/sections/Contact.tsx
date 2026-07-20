"use client";

import { useState, type FormEvent, type ChangeEvent } from "react";
import { toast, Toaster } from "react-hot-toast";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { WHATSAPP_NUMBER, WHATSAPP_MESSAGE, SERVICES } from "@/lib/constants";
import { trackLead, trackContact } from "@/lib/tracking";

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
    service: "",
  });
  const [honeypot, setHoneypot] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // If honeypot is filled, silently pretend success (bot trap)
      if (honeypot) {
        setFormData({ name: "", email: "", phone: "", message: "", service: "" });
        toast.success("ההודעה נשלחה בהצלחה! נחזור אליך בהקדם.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, _hp: honeypot }),
      });

      if (!res.ok) throw new Error("שגיאה בשליחת הטופס");

      // Real conversion — tell Meta/GA4 a lead came in so ads optimize for it.
      // Carries the chosen service so GA4 shows which offering converts.
      trackLead("contact_form", formData.service);
      toast.success("ההודעה נשלחה בהצלחה! נחזור אליך בהקדם.");
      setFormData({ name: "", email: "", phone: "", message: "", service: "" });
    } catch {
      toast.error("שגיאה בשליחת הטופס. נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

  return (
    <section id="contact" className="relative bg-white py-14 md:py-20 px-6">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#FFFFFF", color: "#111", border: "1px solid #E5E7EB" },
        }}
      />

      <div className="max-w-4xl mx-auto">
        <ScrollReveal>
          <h2 className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-center text-black w-full mb-4" data-text="בואו נדבר">
            בואו נדבר
          </h2>
          <p className="text-gray-700 text-center text-lg mb-16">
            ספרו לנו על הפרויקט שלכם ונחזור אליכם בהקדם
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Honeypot field - hidden from real users, catches bots */}
            <div className="absolute opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              <Input
                label="שם מלא"
                type="text"
                value={formData.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="אימייל"
                type="email"
                value={formData.email}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              <Input
                label="טלפון"
                type="tel"
                value={formData.phone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
              />
              <div className="relative">
                <select
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  className="w-full bg-transparent border-b-2 border-gray-300 px-0 py-3 text-black font-meruba outline-none focus:border-pink transition-all duration-300 appearance-none cursor-pointer"
                >
                  <option value="" className="bg-white">בחרו שירות</option>
                  {SERVICES.map((s) => (
                    <option key={s.id} value={s.id} className="bg-white">
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              label="ספרו לנו על הפרויקט"
              multiline
              value={formData.message}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, message: e.target.value })}
              required
            />

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? <LoadingSpinner /> : "שליחה"}
              </Button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackContact("whatsapp", "contact_section")}
                className="chromatic-hover flex items-center gap-2 text-black transition-colors font-bold"
                data-text="דברו איתנו בוואטסאפ"
                data-cursor="pointer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                דברו איתנו בוואטסאפ
              </a>
            </div>
          </form>
        </ScrollReveal>
      </div>
    </section>
  );
}
