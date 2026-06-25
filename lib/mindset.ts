// The daily Mindset "story of the day" registry — one short basketball story
// (~60–90 sec read) shown on the player check-in page. Text-forward; meant to
// provoke thought and drive.
//
// SINGLE source of truth. A plain in-code registry (like lib/gifs.ts) because the
// content is static, curated, and not user-editable — a DB model would add cost
// with no benefit.
//
// HOW TO EDIT / ADD:
//   - Stories are ordered Monday (id 1) → Sunday (id 7). `storyForDay()` maps the
//     weekday to the matching entry, so there is exactly one story per weekday.
//   - To change a day's story, edit that entry's `title`, `player`, and `body`
//     below. Keep exactly 7 entries (one per weekday).
//   - `body` is the full story text. Use blank lines between paragraphs — the card
//     preserves them (whitespace-pre-wrap).

export type MindsetStory = {
  id: number; // 1–7, ordered Monday → Sunday
  title: string;
  player: string; // who the story features — REFERENCE ONLY for editing; NEVER shown to users (so the story stays a guess until they read/hear it)
  body: string; // the story text (~60–90 sec read; blank lines = paragraphs)
};

export const STORIES: MindsetStory[] = [
  // Monday
  {
    id: 1,
    title: "The Cut",
    player: "Michael Jordan",
    body: `The gym smelled like floor wax and old sweat. Morning light came through the high windows in gray columns, and his sneakers squeaked once on the empty floor.

A single sheet of paper was taped to the wall. A few boys were already crowded around it. One of them peeled away grinning, and the kid stepped up to take his place.

The varsity roster. Typed names, black ink. He scanned down to the M's, the way you'd check a score you were sure of.

His name wasn't there.

He read it again, slower, like the letters might rearrange themselves. They didn't. Behind him another boy whooped about making the team, and the sound felt far away.

He was fifteen, and not tall yet — not the way he'd be later. There were flashier players ahead of him. By everything the coaches could actually see that morning, the paper wasn't a lie. He just wasn't ready.

He didn't say a word. He walked home, went up to his room, shut the door — and there, where no one could see the best player who'd ever live, he cried.

And then he made a decision. Not that the paper was wrong about today. It was right about today. He decided it was wrong about tomorrow.

He dropped down to JV and started scoring 40 in a night. He showed up before school, when the gym was cold and empty. He stayed after everyone left. And every time his legs begged him to quit, he pictured one thing: that sheet of paper, taped to the wall, without his name on it.

You know him now. Michael Jordan. Six championships. The name people reach for when they argue about the greatest who ever played.

The cut didn't break him. It built him.

So when somebody tells you you're not good enough — a coach, a list on a wall, somebody in the hallway — maybe they're right about you today. Today you might not be ready. But they don't get to decide tomorrow. You do. And there's one word that settles it: yet.`,
  },
  // Tuesday
  {
    id: 2,
    title: "4 A.M.",
    player: "Kobe Bryant",
    body: `The trainer's phone buzzed before a Team USA summer. It was Kobe Bryant, asking for help with some conditioning work. Sure, the trainer said. What time?

Four a.m., Kobe said.

The trainer got to the gym a few minutes before four, half-asleep, sure he'd be the first one there. The lights were already on. Kobe was on the floor, soaked through his shirt, breathing hard. He'd been at it for a while.

They worked until seven. Then the trainer drove back to the hotel and slept.

Hours later he came back for the team's real practice — the official one, the whole roster, the middle of the day. Kobe was still there. Same shirt, dried stiff with salt now, up on the wing, shooting. He hadn't left.

Afterward the trainer asked him straight: You were here at four. You're still here. Why?

Kobe's answer was simple. He said he wanted to be the best player in the world. And if he got up while the other best players were still asleep — if he put in two extra workouts before they'd even had breakfast — then a little each day, the gap between him and them would grow. Until one day it would be too wide for anyone to close.

That was it. No secret drill. No magic. Just a man choosing an empty gym at four in the morning, over and over, while everyone he was chasing hit snooze.

Nobody made him do that. No coach stood over him. No crowd watched. He decided it alone, in the dark, when quitting would've been easy and no one would ever have known.

That's the part no one can give you. When there's no game, no whistle, no one in the stands — and you go anyway, because you said you would — that's the morning you start becoming great.`,
  },
  // Wednesday
  {
    id: 3,
    title: "Before the Sun",
    player: "Larry Bird",
    body: `French Lick, Indiana. A small town, the kind where everybody knows whose kid you are and money's always a little tight.

The boy got up before the sun. While the town was still dark and quiet, before school, he was already at the court, alone, shooting. Free throw after free throw after free throw. Five hundred of them some mornings, before most kids had opened their eyes.

He wasn't the fastest. He couldn't jump out of the gym. When he'd get to the NBA, people would say it out loud — too slow, can't jump, shouldn't be this good. And he'd just keep beating them.

Because while they were talking about what he couldn't do, he'd already shot ten thousand more jumpers than they had. The shot that looked so automatic, so easy, in front of a screaming crowd — he'd taken it ten thousand times in an empty gym in the cold, with no one there to clap.

His name was Larry Bird. Three championships. One of the greatest to ever play, in a body that was supposedly all wrong for it.

Here's the thing nobody likes to hear: he wasn't born that good. He out-worked his way there, one freezing morning at a time, alone, before the sun.

You want to know if you can be great? Don't ask the mirror. Ask yourself what you're willing to do before anyone else is awake.`,
  },
  // Thursday
  {
    id: 4,
    title: "Too Small",
    player: "Stephen Curry",
    body: `By his senior year of high school, he was good. Really good. But he was small — skinny, baby-faced, looked two years younger than everyone he played against.

So the big colleges passed. The programs every kid dreams about — the ones with the famous jerseys and the packed arenas — looked at him and saw a kid too small to matter. Not one of them offered him a real scholarship.

His own father had been an NBA player. He'd grown up around the league. And still, nobody big wanted him.

He ended up at a tiny school called Davidson — a college so small most basketball fans couldn't find it on a map. The kind of place you go when no one else calls.

And there, the skinny kid nobody wanted started doing something to the sport that no one had ever quite seen. Shots from so far out they looked like mistakes — except they kept going in. He dragged little Davidson deep into the national tournament while the whole country slowly learned his name.

Steph Curry. Four championships. A two-time MVP. The man who changed how the entire game is played.

Every big school that passed on him was right about one thing — he was small. They were just wrong about what that meant.

So if you're the smallest one out there, the one getting overlooked — good. Remember the feeling. Some of the greatest who ever lived started exactly where you're standing.`,
  },
  // Friday
  {
    id: 5,
    title: "The Boy Who Wouldn't Put It Down",
    player: "Pistol Pete Maravich",
    body: `There was a boy in the Carolinas who could not stop dribbling a basketball.

Not would not — could not. He dribbled to the store. He dribbled down the street alongside his bike. People say he'd dribble out the window of a moving car just to feel the ball come back to his hand at speed. He took it to bed with him like other kids take a stuffed animal.

His father, Press, was a coach, and the two of them turned basketball into something closer to an obsession. Drills most people had never heard of. Hours that didn't seem to end. The boy would spin the ball, slap it, weave it through his legs in the dark until his hands knew it better than they knew anything.

By the time he was a man, he did things with a basketball that made grown crowds gasp — passes nobody saw coming, shots nobody dared try. They called him "Pistol" Pete Maravich, and to this day he holds college scoring records that have stood for over fifty years, set in an era with no three-point line.

People watched him and called it a gift. It wasn't a gift. It was a boy who refused to put the ball down — for years — until it became part of him.

Talent is real. But talent is just the seed. What you do with a ball when nobody's making you — that's what decides how good you actually get.`,
  },
  // Saturday
  {
    id: 6,
    title: "The Smile",
    player: "Magic Johnson",
    body: `Most of the legends will tell you a story about suffering. About 4 a.m. and empty gyms and proving the doubters wrong. This one's different.

There was a kid in Lansing, Michigan, who loved basketball so much that people couldn't help but love watching him play it. He played with a grin on his face. He'd throw a pass behind his back, between two defenders, right into a teammate's hands for an easy layup — and then he'd be more excited about their basket than he would've been about his own.

That was the whole thing about him. He made the players around him better, and he made them happier. A local sportswriter watched him do it as a teenager and started calling him "Magic." The name stuck for the rest of his life.

Magic Johnson. Five championships. And he won them not by being the most selfish star on the floor, but by being the most generous one — the guy whose greatest joy was making everyone else look great.

Here's what people miss: the assist, the extra pass, the moment you give up your own shot so a teammate can have a better one — that's not weakness. On the best teams that ever played, it was the whole secret.

You can be the kind of player who lights up when you score. Or you can be the kind who lights up when your team does. One of those makes you good. The other one makes you Magic.`,
  },
  // Sunday
  {
    id: 7,
    title: "Traded Away",
    player: "Shai Gilgeous-Alexander",
    body: `He wasn't supposed to be the one.

Coming out of high school, the recruiters ranked him somewhere around 31st — good, not special. He went to Kentucky expected to sit behind a more famous point guard, and most people figured he'd be a role player and disappear.

Then came draft night, 2018. A team picked him — and traded him away that same night, before he'd even worn the jersey. Pick him, ship him out, all in one evening.

A year later, it happened again. He got traded a second time — this time he was the extra piece thrown into a bigger deal so two teams could swap a famous superstar. Twice now, teams had looked at him and decided someone else mattered more. He landed in Oklahoma City almost as an afterthought.

So he went to work in a small market with no spotlight on him, and got a little better every single season. Quietly. Steadily. While nobody was paying attention.

In 2025 the kid who got traded away twice won the scoring title, won MVP, and led that overlooked little team to a championship — and was named the best player in the Finals.

Shai Gilgeous-Alexander. The throw-in. The extra piece. The guy two teams gave up on.

When somebody decides you're not the one — that you're the piece they can afford to lose — remember this: that's their call about today. What you become next is entirely yours.`,
  },
];

// The story for a given calendar day. Same story all day; cycles weekly
// (Mon → id 1 … Sun → id 7). Deterministic from the day key (YYYY-MM-DD), never
// re-randomized on refresh.
export function storyForDay(dayKey: string): MindsetStory {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0=Mon … 6=Sun
  return STORIES[weekday];
}
