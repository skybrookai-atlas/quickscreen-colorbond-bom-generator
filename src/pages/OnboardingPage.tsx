import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/Button";
import { AnyfenceLogo } from "../components/brand/AnyfenceLogo";
import { toast } from "sonner";
import { ShieldCheck, UserCheck, ChevronRight, User, Mail, Lock, Building, Phone, MapPin, BadgeDollarSign } from "lucide-react";

type RoleType = "contractor" | "supplier";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<RoleType>("contractor");
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Contractor specific
  const [postcodes, setPostcodes] = useState("");
  const [installRate, setInstallRate] = useState("55"); // default $55/m

  // Supplier specific
  const [brandColour, setBrandColour] = useState("#319ad6");
  const [metros] = useState<string[]>(["Sydney", "Melbourne", "Brisbane"]);
  const [website, setWebsite] = useState("");

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      toast.error("Please fill in all account credentials.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setStep(2);
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !phone) {
      toast.error("Company name and phone number are required.");
      return;
    }

    setLoading(true);
    toast.loading("Creating your Amazing Fencing portal...", { id: "onboard" });

    try {
      // 1. Sign up the user in Supabase Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
          }
        }
      });

      if (authErr) throw authErr;
      const user = authData.user;
      if (!user) throw new Error("Failed to create user account.");

      // Delay briefly to allow auth trigger to create profile
      await new Promise(r => setTimeout(r, 600));

      if (role === "contractor") {
        // 2. Contractor Flow:
        // Update user profile and set contractor type
        const postcodeArray = postcodes
          .split(",")
          .map(p => p.trim())
          .filter(Boolean);

        const { error: profileErr } = await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            company: companyName,
            phone: phone,
            user_type: "contractor",
            pricing_tier: "tier2", // Trade tier
            postcodes_serviced: postcodeArray
          })
          .eq("id", user.id);

        if (profileErr) throw profileErr;

        // Get system instances to assign base rate
        const { data: instances } = await supabase
          .from("system_instances")
          .select("id")
          .eq("status", "active")
          .limit(3);

        if (instances && instances.length > 0) {
          const rateRows = instances.map(inst => ({
            contractor_id: user.id,
            calculator_id: inst.id,
            rate_per_meter: parseFloat(installRate) || 55,
            rate_per_item: {},
            custom_markup_percentage: 0
          }));

          const { error: rateErr } = await supabase
            .from("contractor_install_rates")
            .insert(rateRows);

          if (rateErr) console.warn("Failed to insert install rates:", rateErr.message);
        }

        toast.success("Welcome aboard! Your contractor account is ready.", { id: "onboard" });
        navigate("/contractor");
      } else {
        // 3. Supplier Flow:
        const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        // Create new organisation row
        const { data: org, error: orgErr } = await supabase
          .from("organisations")
          .insert({
            name: companyName,
            slug: companySlug,
            branding: {
              cssVars: {
                "--brand-bg": "#f8fafc",
                "--brand-card": "#ffffff",
                "--brand-border": "#cbd5e1",
                "--brand-primary": brandColour.replace("#", ""), // just value
                "--brand-accent": brandColour.replace("#", ""),
                "--brand-muted": "#64748b",
                "--brand-text": "#1e293b",
                "--brand-radius": "0.5rem"
              },
              branding: {
                title: companyName,
                subtitle: "Supplier Portal",
                hideThemeToggle: true
              }
            }
          })
          .select("id")
          .single();

        if (orgErr) throw orgErr;

        // Update profile org_id and user_type
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({
            org_id: org.id,
            full_name: fullName,
            company: companyName,
            phone: phone,
            user_type: "supplier_staff",
            role: "owner"
          })
          .eq("id", user.id);

        if (profileErr) throw profileErr;

        // Insert new supplier row
        const { error: supplierErr } = await supabase
          .from("suppliers")
          .insert({
            name: companyName,
            slug: companySlug,
            org_id: org.id,
            brand_colour: brandColour,
            contact_email: email,
            authored_by: user.id,
            status: "active",
            trust_tier: "verified",
            metadata: {
              website,
              metros_serviced: metros
            }
          });

        if (supplierErr) throw supplierErr;

        toast.success("Welcome! Your supplier portal has been initialized.", { id: "onboard" });
        navigate(`/s/${companySlug}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An onboarding error occurred.", { id: "onboard" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <AnyfenceLogo showSubtitle={true} />
        </div>

        {/* Card */}
        <div className="bg-brand-card border border-brand-border rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black">
              {step === 1 ? "Start Fencing Smarter" : "Setup Business Portal"}
            </h2>
            <p className="text-brand-muted text-sm mt-1">
              {step === 1 
                ? "Create your account credentials to join our pricing network" 
                : `Enter your details to configure your ${role === "contractor" ? "Contractor Profile" : "Supplier Brand"}`}
            </p>
          </div>

          {/* Form Step 1: Account credentials */}
          {step === 1 ? (
            <form onSubmit={handleNextStep} className="space-y-4">
              {/* Role selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-2">I want to onboard as a:</label>
                <div className="grid grid-cols-2 gap-3 bg-brand-bg/50 p-1.5 rounded-2xl border border-brand-border/40">
                  <button
                    type="button"
                    onClick={() => setRole("contractor")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                      role === "contractor"
                        ? "bg-brand-accent text-white shadow-lg"
                        : "text-brand-muted hover:text-brand-text"
                    }`}
                  >
                    <UserCheck size={18} />
                    Contractor
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("supplier")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                      role === "supplier"
                        ? "bg-brand-accent text-white shadow-lg"
                        : "text-brand-muted hover:text-brand-text"
                    }`}
                  >
                    <ShieldCheck size={18} />
                    Supplier
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-muted">Contact Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-brand-bg/60 border border-brand-border/80 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-muted">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                  <input
                    type="email"
                    required
                    placeholder="e.g. john@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-brand-bg/60 border border-brand-border/80 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-muted">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-brand-bg/60 border border-brand-border/80 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full justify-center mt-2" variant="primary">
                Next: Business Details
                <ChevronRight size={16} />
              </Button>
            </form>
          ) : (
            /* Form Step 2: Role Details */
            <form onSubmit={handleOnboard} className="space-y-4">
              {/* Company Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-muted">Company Name</label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Paramount Fences"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-brand-bg/60 border border-brand-border/80 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-muted">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0400 000 000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-brand-bg/60 border border-brand-border/80 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {role === "contractor" ? (
                <>
                  {/* Contractor Postcodes */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-muted">Postcodes Serviced (comma-separated)</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                      <input
                        type="text"
                        placeholder="e.g. 4000, 4001, 4207"
                        value={postcodes}
                        onChange={(e) => setPostcodes(e.target.value)}
                        className="w-full bg-brand-bg/60 border border-brand-border/80 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  {/* Installation Rate */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-muted">Standard Install Rate per Metre ($ AUD)</label>
                    <div className="relative">
                      <BadgeDollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted" size={16} />
                      <input
                        type="number"
                        placeholder="e.g. 55"
                        value={installRate}
                        onChange={(e) => setInstallRate(e.target.value)}
                        className="w-full bg-brand-bg/60 border border-brand-border/80 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Supplier website */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-muted">Website URL</label>
                    <input
                      type="url"
                      placeholder="https://mysupplier.com.au"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full bg-brand-bg/60 border border-brand-border/80 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-brand-primary"
                    />
                  </div>

                  {/* Supplier brand color */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-brand-muted block">Brand Primary Colour</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={brandColour}
                        onChange={(e) => setBrandColour(e.target.value)}
                        className="h-10 w-12 border-0 bg-transparent rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={brandColour}
                        onChange={(e) => setBrandColour(e.target.value)}
                        className="bg-brand-bg/60 border border-brand-border/80 rounded-2xl py-2 px-4 text-sm font-mono text-center w-28 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Navigation Actions */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button type="button" variant="secondary" className="justify-center" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" variant="primary" className="justify-center" disabled={loading}>
                  {loading ? "Processing..." : "Complete Setup"}
                </Button>
              </div>
            </form>
          )}

          {/* Sign in fallback */}
          <p className="text-center text-xs text-brand-muted mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-primary hover:underline font-semibold">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
