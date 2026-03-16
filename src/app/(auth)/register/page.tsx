import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-160px)]">
      <SignUp 
        appearance={{
          elements: {
            formButtonPrimary: 
              "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold",
            card: "bg-slate-900 border border-slate-800",
            headerTitle: "text-white",
            headerSubtitle: "text-slate-400",
            socialButtonsBlockButton: "bg-slate-950 border-slate-800 text-white hover:bg-slate-800",
            formFieldLabel: "text-slate-300",
            formFieldInput: "bg-slate-950 border-slate-800 text-white focus:ring-emerald-500",
            footerActionLink: "text-emerald-400 hover:text-emerald-300",
            identityPreviewText: "text-white",
            identityPreviewEditButtonIcon: "text-emerald-400"
          }
        }}
      />
    </div>
  );
}
