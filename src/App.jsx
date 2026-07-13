import { useState } from "react";
import Landing from "./components/Landing";
import Experience from "./components/Experience";

export default function App() {
  const [started, setStarted] = useState(false);

  return (
    <div className="crt h-screen w-screen overflow-hidden">
      {started ? (
        <Experience onExit={() => setStarted(false)} />
      ) : (
        <Landing onStart={() => setStarted(true)} />
      )}
    </div>
  );
}
