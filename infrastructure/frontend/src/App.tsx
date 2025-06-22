import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Amplify } from "aws-amplify";

// Pages
import LandingPage from "./pages/LandingPage";
import CitizenScanner from "./pages/CitizenScanner";
import AdminDashboard from "./pages/AdminDashboard";
import LoginPage from "./pages/LoginPage";

// AWS Amplify Configuration
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID || "us-east-1_example",
      userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || "example",
      loginWith: {
        oauth: {
          domain:
            import.meta.env.VITE_OAUTH_DOMAIN ||
            "example.auth.us-east-1.amazoncognito.com",
          scopes: ["openid", "email", "profile"],
          redirectSignIn: [window.location.origin + "/admin"],
          redirectSignOut: [window.location.origin],
          responseType: "code" as const,
        },
      },
    },
  },
  API: {
    REST: {
      ecoscanAPI: {
        endpoint:
          import.meta.env.VITE_API_ENDPOINT || "https://api.example.com",
        region: import.meta.env.VITE_AWS_REGION || "us-east-1",
      },
    },
  },
};

try {
  Amplify.configure(amplifyConfig);
} catch (error) {
  console.warn("Amplify configuration failed:", error);
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/scan" element={<CitizenScanner />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            className: "bg-white shadow-lg",
            duration: 4000,
          }}
        />
      </div>
    </Router>
  );
}

export default App;
