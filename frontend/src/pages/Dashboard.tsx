interface DashboardProps {
  dashboardUrl: string;
}

export default function Dashboard({ dashboardUrl }: DashboardProps) {
  return (
    <iframe
      src={dashboardUrl}
      className="w-full h-full border-0"
      title="APEX Dashboard"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
