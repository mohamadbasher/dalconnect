import { S } from "@/lib/strings";
import { signIn } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: S.loginErrorInvalid,
  not_admin: S.loginErrorNotAdmin,
  missing: S.loginErrorMissing,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERRORS[error] ?? S.actionError : null;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand side panel */}
      <div className="hero-gradient relative hidden flex-col justify-between p-10 text-white lg:flex">
        <div className="text-lg font-bold opacity-90">{S.brandShort}</div>
        <div>
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-4xl font-black backdrop-blur-sm">
            د
          </div>
          <h1 className="text-3xl font-extrabold leading-relaxed">
            {S.appName}
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-7 text-white/85">
            إدارة المستخدمين والمهنيين والحجوزات والبلاغات — كل شيء في مكان
            واحد.
          </p>
        </div>
        <div className="text-xs text-white/70">
          © {new Date().getFullYear()} DalConnect
        </div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center bg-[#faf7f4] p-6">
        <div className="card w-full max-w-md p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-2xl font-black text-white lg:hidden">
              د
            </div>
            <h2 className="text-xl font-bold">{S.loginTitle}</h2>
            <p className="mt-1 text-sm text-[#8a7a6d]">{S.loginSubtitle}</p>
          </div>

          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          <form action={signIn} className="space-y-4">
            <div>
              <label
                htmlFor="identifier"
                className="mb-1.5 block text-sm font-semibold"
              >
                {S.identifierLabel}
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                dir="ltr"
                className="input text-right"
                placeholder={S.identifierPlaceholder}
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold"
              >
                {S.passwordLabel}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                dir="ltr"
                className="input text-right"
              />
            </div>
            <SubmitButton label={S.loginButton} className="btn-primary w-full" />
          </form>
        </div>
      </div>
    </div>
  );
}
