import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="min-h-[85vh] p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
        </div>
      </div>
      
      <div className="w-full max-w-3xl self-start bg-card border border-border shadow-2xl rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4">Account Settings</h2>
        <p className="text-muted-foreground mb-6">Update your display name from the top right profile menu.</p>
        
        <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
              <h3 className="font-semibold mb-1">API Keys (Coming Soon)</h3>
              <p className="text-sm text-muted-foreground">Manage your API keys for external integrations here in the future.</p>
            </div>
             <div className="p-4 bg-muted/50 rounded-xl border border-border/50">
              <h3 className="font-semibold mb-1">Subscription</h3>
              <p className="text-sm text-muted-foreground">You are currently on the Creator Pro plan.</p>
            </div>
        </div>
      </div>
    </div>
  );
}
