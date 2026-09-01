import { JourneyProvider } from "./journey/JourneyProvider";
import { Journey } from "./journey/Journey";

export default function App() {
  return (
    <JourneyProvider>
      <Journey />
    </JourneyProvider>
  );
}
