import { RulesContent } from "@/components/rules-content";

export default function SitinPage() {
  return (
    <RulesContent
      title="Sit-In"
      subtitle="University of Cebu"
      intro="COLLEGE OF INFORMATION & COMPUTER STUDIES — SIT-IN RULES AND REGULATIONS"
      sections={[
        {
          heading: "Sit-In Rules and Regulations",
          items: [
            "Only authorized sit-in students with prior approval from the instructor are allowed.",
            "Sit-in students must not disrupt the class or engage in side conversations.",
            "Mobile phones and other electronic devices must be set to silent mode during the session.",
            "Sit-in students must not use laboratory computers unless explicitly permitted by the instructor.",
            "Seats are prioritized for officially enrolled students. Sit-in students should occupy vacant seats only.",
            "Participation in discussions or activities is allowed only if the instructor permits.",
            "Eating, drinking, or any form of littering is strictly prohibited inside the classroom.",
            "Sit-in students must follow the instructor’s guidelines and classroom rules at all times.",
            "Disruptive behavior, including excessive talking, arguing, or any form of distraction, will not be tolerated.",
            "Failure to follow these rules may result in the immediate removal from the class and possible restrictions on future sit-in requests.",
          ],
        },
        {
          heading: "Disciplinary Action",
          items: [
            "First Offense - A verbal warning will be issued by the instructor.",
            "Second Offense - The student will be asked to leave and reported to the administration.",
            "Third Offense - A formal complaint may be filed, leading to further disciplinary actions.",
          ],
        },
      ]}
    />
  );
}
