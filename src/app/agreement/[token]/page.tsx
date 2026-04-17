import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SignAgreementClient from "./SignAgreementClient";

export const dynamic = "force-dynamic";

export default async function AgreementSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const agreement = await prisma.agreement.findUnique({
    where: { signToken: token },
    select: {
      tier: true,
      monthlyPrice: true,
      customerName: true,
      businessName: true,
      idNumber: true,
      phone: true,
      email: true,
      status: true,
      content: true,
      signedAt: true,
    },
  });

  if (!agreement) notFound();

  if (agreement.status === "CANCELLED") {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-6">
        <div className="max-w-md text-center bg-gray-900 border border-gray-800 rounded-2xl p-10">
          <h1 className="text-2xl font-bold mb-3">ההסכם בוטל</h1>
          <p className="text-gray-400">לא ניתן לחתום על הסכם זה. אנא צור קשר עם Fuzion Webz.</p>
        </div>
      </div>
    );
  }

  if (agreement.status === "SIGNED") {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-6">
        <div className="max-w-md text-center bg-gray-900 border border-gray-800 rounded-2xl p-10">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-3">ההסכם כבר נחתם</h1>
          <p className="text-gray-400">
            ההסכם נחתם בתאריך{" "}
            {agreement.signedAt
              ? new Date(agreement.signedAt).toLocaleDateString("he-IL")
              : ""}
            . תודה!
          </p>
        </div>
      </div>
    );
  }

  return (
    <SignAgreementClient
      token={token}
      content={agreement.content}
      initial={{
        customerName: agreement.customerName,
        businessName: agreement.businessName,
        idNumber: agreement.idNumber,
        phone: agreement.phone,
        email: agreement.email,
      }}
    />
  );
}
