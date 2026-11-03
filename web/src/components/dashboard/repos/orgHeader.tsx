type OrgHeaderProps = {
  orgName: string;
};

export default function OrgHeader({ orgName }: OrgHeaderProps) {
  return <div className="text-2xl text-foreground">{orgName}</div>;
}
