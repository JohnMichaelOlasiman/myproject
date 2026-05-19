import { RulesContent } from "@/components/rules-content";

export default function LaboratoryPage() {
  return (
    <RulesContent
      title="Laboratory"
      subtitle="University of Cebu"
      intro="COLLEGE OF INFORMATION & COMPUTER STUDIES — LABORATORY RULES AND REGULATIONS"
      sections={[
        {
          heading: "Laboratory Rules and Regulations",
          items: [
            "Maintain silence, proper decorum, and discipline inside the laboratory. Mobile phones, walkmans and other personal pieces of equipment must be switched off.",
            "Games are not allowed inside the lab. This includes computer-related games, card games and other games that may disturb the operation of the lab.",
            "Surfing the Internet is allowed only with the permission of the instructor. Downloading and installing of software are strictly prohibited.",
            "Getting access to other websites not related to the course (especially pornographic and illicit sites) is strictly prohibited.",
            "Deleting computer files and changing the set-up of the computer is a major offense.",
            "Observe computer time usage carefully. A fifteen-minute allowance is given for each use. Otherwise, the unit will be given to those who wish to sit-in.",
            "Observe proper decorum while inside the laboratory.",
            "Do not get inside the lab unless the instructor is present.",
            "All bags, knapsacks, and the likes must be deposited at the counter.",
            "Follow the seating arrangement of your instructor.",
            "At the end of class, all software programs must be closed.",
            "Return all chairs to their proper places after using.",
            "Chewing gum, eating, drinking, smoking, and other forms of vandalism are prohibited inside the lab.",
            "Anyone causing a continual disturbance will be asked to leave the lab.",
            "Acts or gestures offensive to the members of the community, including public display of physical intimacy, are not tolerated.",
            "Persons exhibiting hostile or threatening behavior such as yelling, swearing, or disregarding requests made by lab personnel will be asked to leave the lab.",
            "For serious offense, the lab personnel may call the Civil Security Office (CSU) for assistance.",
            "Any technical problem or difficulty must be addressed to the laboratory supervisor, student assistant or instructor immediately.",
          ],
        },
        {
          heading: "Disciplinary Action",
          items: [
            "First Offense - The Head or the Dean or OIC recommends to the Guidance Center for a suspension from classes for each offender.",
            "Second and Subsequent Offenses - A recommendation for a heavier sanction will be endorsed to the Guidance Center.",
          ],
        },
      ]}
    />
  );
}
