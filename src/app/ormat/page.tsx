import { prisma } from "@/lib/prisma";
import { ORMAT_PROPOSAL_TOKEN } from "@/config/ormat-proposal";
import OrmatProposalClient from "./OrmatProposalClient";

// Always reflect the live agreement status (signed vs. open).
export const dynamic = "force-dynamic";

export default async function OrmatPage() {
  const agreement = await prisma.agreement.findUnique({
    where: { signToken: ORMAT_PROPOSAL_TOKEN },
    select: { status: true },
  });

  if (!agreement) {
    return (
      <Center>
        <h1 className="text-2xl font-extrabold">ההצעה תהיה זמינה בקרוב</h1>
        <p className="text-gray-400 mt-3 text-sm">העמוד עדיין בהכנה. נחזור אליכם בהקדם.</p>
      </Center>
    );
  }

  if (agreement.status === "SIGNED" || agreement.status === "CANCELLED") {
    return (
      <Center>
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-pink to-cyan-dark flex items-center justify-center text-3xl text-white">
          {agreement.status === "SIGNED" ? "✓" : "•"}
        </div>
        <h1 className="text-2xl font-extrabold">
          {agreement.status === "SIGNED" ? "ההצעה כבר נחתמה. תודה!" : "ההצעה אינה פעילה"}
        </h1>
        <p className="text-gray-500 mt-3 text-sm">
          לכל שאלה אנחנו כאן:{" "}
          <a href="https://www.fuzionwebz.com/contact" className="text-pink hover:underline">
            צרו קשר
          </a>
        </p>
      </Center>
    );
  }

  return <OrmatProposalClient token={ORMAT_PROPOSAL_TOKEN} />;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center text-gray-900">
      <div>{children}</div>
    </div>
  );
}
