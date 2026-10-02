import { http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "YOUR_WALLETCONNECT_PROJECT_ID";

export const config = getDefaultConfig({
  appName: "Compose Launchpad",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
});
