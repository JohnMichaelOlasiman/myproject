import { StudentShell } from "./student-shell";

type RulesSection = {
  heading: string;
  items: string[];
};

export function RulesContent({
  title,
  subtitle,
  intro,
  sections,
}: {
  title: string;
  subtitle: string;
  intro: string;
  sections: RulesSection[];
}) {
  return (
    <StudentShell title={title}>
      <div className="mx-auto max-w-4xl rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-center text-xl font-semibold">{subtitle}</h2>
        <p className="mb-4">{intro}</p>
        {sections.map((section) => (
          <section key={section.heading} className="mb-5">
            <h3 className="mb-2 text-lg font-bold uppercase">{section.heading}</h3>
            <ol className="list-decimal space-y-2 pl-5">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </StudentShell>
  );
}
