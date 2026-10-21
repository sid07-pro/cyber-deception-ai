# Cyber Deception AI — Presentation Rehearsal

**Target length:** about 13 minutes for slides 1–23, then questions. The backup slides (24–31) are only for questions.

**How to use this script:**
- Learn the **key points** of each slide. Don't memorise every word.
- Practise saying each slide's script aloud twice, then try it from the key points alone.
- The full teaching notes are in each slide's speaker notes in the PPTX.

---

## Timing plan

| # | Slide | Time | Cumulative |
|---|---|---|---|
| 1 | Title | 0:30 | 0:30 |
| 2 | Problem | 0:45 | 1:15 |
| 3 | Objectives | 0:40 | 1:55 |
| 4 | Deception fundamentals | 0:40 | 2:35 |
| 5 | Existing vs proposed | 0:35 | 3:10 |
| 6 | Architecture | 0:50 | 4:00 |
| 7 | Tech stack | 0:30 | 4:30 |
| 8 | Graph G=(V,E) | 0:40 | 5:10 |
| 9 | Four algorithms | 1:00 | 6:10 |
| 10 | UCS worked example | 0:50 | 7:00 |
| 11 | Attack-path analysis | 0:35 | 7:35 |
| 12 | Deception score | 0:50 | 8:25 |
| 13 | What "AI" means | 0:40 | 9:05 |
| 14 | End-to-end flow | 0:40 | 9:45 |
| 15–16 | App walkthrough | 1:00 | 10:45 |
| 17 | Code | 0:35 | 11:20 |
| 18 | Testing | 0:30 | 11:50 |
| 19 | Results + caveat | 0:40 | 12:30 |
| 20 | Safety & limitations | 0:30 | 13:00 |
| 21 | Future scope | 0:20 | 13:20 |
| 22 | Conclusion | 0:25 | 13:45 |
| 23 | References | 0:05 | 13:50 |

If you're short on time, shorten slides 5, 7, 14 and 21 to one sentence each.

---

## Spoken script

### 1 · Title (0:30)
"Good morning. I'm Chidwilas Routhu, 24BYB0092. My project is **Cyber Deception AI**: an AI-based cyber deception system for intelligent honeypot placement and attacker path prediction. In one line: I model a network as a graph, predict the route an attacker would take to a critical database, and decide where to put honeypots so that route is intercepted. Everything runs on a simulated network."

*Emphasis:* "simulated network". Say it early so nobody later thinks you're claiming a live system.

### 2 · Problem (0:45)
"Firewalls and patching are essential, but once an attacker is inside, defenders often can't see where they go next. Honeypots help, because nobody legitimate should touch them, so any touch is a strong alert. The catch is that you can only afford a few. So the question my project answers is: **given a network and a budget, where should the honeypots go?**"

### 3 · Objectives (0:40)
"I set five objectives: model, predict, place, explain and evaluate. All five are implemented and tested. The bottom box lists what I deliberately did **not** do: real networks, real telemetry and machine learning."

### 4 · Deception fundamentals (0:40)
"Cyber deception means planting false assets. A honeypot is a single decoy system, and a honeynet is a network of them. In the diagram, the attacker heads for the real database, but if a decoy sits on that route, we see the attacker first. In my simulation, a honeypot is a label on a graph node, and 'interception' means the predicted path passes through that node."

### 5 · Existing vs proposed (0:35)
"Without a method, placement depends on intuition. My approach ties placement to predicted routes, a budget and a deployment cost, and it explains every choice. This is a conceptual comparison. I haven't benchmarked against commercial tools, and I won't claim to beat them."

### 6 · Architecture (0:50)
"There are four layers:
- **React frontend:** renders the graph and the results.
- **FastAPI:** validates every request with Pydantic.
- **Services layer:** calls the algorithm modules, which are plain Python with NetworkX and know nothing about HTTP.
- **Persistence:** SQLAlchemy, with SQLite by default or PostgreSQL in Docker.

Docker Compose runs all three services, and I verified that stack end to end."

### 7 · Tech stack (0:30)
"Each tool has one job:
- NetworkX for the graph;
- FastAPI for typed endpoints;
- React with React Flow for the interactive graph;
- pytest and Vitest for testing.

One detail matters: the four search algorithms are written by hand. They are not NetworkX calls."

### 8 · Graph (0:40)
"The network is a graph G = (V, E): seven hosts and nine links. It is undirected and weighted, and a path's cost is the sum of its weights. For example, Internet to Web Server to Application Server to Database costs one plus two plus five, which is eight. Notice that the Internet has only one neighbour, the Web Server. That fact will matter later."

*Emphasis:* point at the Web Server.

### 9 · Four algorithms (1:00)
"The attacker agent can use four algorithms:
- **BFS** uses a queue and finds the route with the fewest hops, but it ignores cost.
- **DFS** uses a stack and dives deep. It finds *a* route, but not necessarily a good one.
- **UCS** uses a priority queue ordered by cost so far, and it is guaranteed optimal for positive weights.
- **A\*** adds a heuristic estimate of the remaining cost. If that estimate never overestimates, A\* is also optimal.

On my network all four find the same route, costing eight. They explore five, four, seven and seven nodes respectively."

*Pronounce:* "A-star". "Heuristic" is "hyoo-RIS-tik". "Admissible" means *never overestimates*.

### 10 · UCS worked example (0:50)
"Here is UCS step by step on the real network:
1. We pop Internet at cost zero and push Web Server at one.
2. Web Server gives Application Server and Employee PC at three.
3. Application Server pushes Database at eight. But we don't stop there.
4. We still pop Employee PC, Admin PC and File Server, which offer routes of nine and ten. Both are rejected.
5. Only when Database is *popped* at eight do we return.

That pop rule is exactly why UCS is optimal."

### 11 · Attack-path analysis (0:35)
"Besides the chosen route, the system lists the three cheapest loop-free routes, using Yen's algorithm. They cost eight, nine and ten. That tells us which routes matter. It does **not** tell us a link is really exploitable or what a real attacker will do. This is graph search, not a trained predictor."

### 12 · Deception score (0:50)
"The defender scores each candidate: path frequency plus proximity plus degree, divided by deployment cost. For the Web Server that's four, plus one third, plus three, divided by two, which is 3.667, the highest score. With a budget of two, the Web Server and the Employee PC are chosen. I call this what it is: a greedy heuristic. For example, the Employee PC wins mainly because it's cheap."

### 13 · What "AI" means (0:40)
"I want to be precise about 'AI'. This project uses classical AI:
- search;
- agents;
- a heuristic;
- optimisation with Hill Climbing and a Genetic Algorithm;
- adversarial search with Minimax and Alpha-Beta;
- Bayesian reasoning;
- planning.

It does **not** use machine learning; there is no trained model. For security decisions, I think being able to trace every number matters more."

### 14 · End-to-end flow (0:40)
"One click goes through eight steps:
1. The UI calls runSimulation.
2. That posts to /api/simulate.
3. Pydantic validates the request; bad input gets a 422.
4. The service builds the graph.
5. The attacker runs the searches.
6. The defender scores the candidates.
7. The service computes interception, the alternative routes and the explanations.
8. The UI draws the result."

### 15–16 · App walkthrough (1:00)
"These are real screenshots of the running app.
- **Slide 15:** the route is in gold and the decoys are tagged. The result shows cost eight, seven nodes explored, and interception at the Web Server on step one.
- **Slide 16:** the placement page compares the greedy score, Hill Climbing and the Genetic Algorithm on the same scenario. Both optimisers reach fitness 6.2667. The topology page lets me click any host and inspect its real properties."

*Optional:* switch to the live app here (see the demo script in the Viva Guide, Part I).

### 17 · Code (0:35)
"On the left is the core UCS loop: pop the cheapest entry, skip it if already visited, return at the goal, otherwise relax the neighbours. On the right, score_candidates computes the three terms, divides by cost, sorts, and takes the top k."

### 18 · Testing (0:30)
"There are 170 backend tests and 44 frontend tests, and all pass. The type check and the production build are clean. The key algorithm tests cover:
- unreachable targets;
- cycles;
- a graph where BFS and UCS must disagree;
- random graphs where UCS and A\* must match NetworkX.

I don't have a browser end-to-end suite, so I checked the UI by hand."

### 19 · Results + caveat (0:40)
"With one honeypot over twenty runs:
- no deception gives zero percent interception;
- random placement gives fifty percent;
- greedy, Hill Climbing and the GA all give one hundred percent.

Alpha-Beta reaches the same decision as Minimax with about half the states, 35 versus 69. **But** the 100% is easy here: every route goes through the Web Server. So this shows the pipeline works. It doesn't prove the method generalises."

*Emphasis:* say the caveat **before** they ask. It builds credibility.

### 20 · Safety & limitations (0:30)
"Everything is synthetic: no real hosts, scanning or exploits. Inputs are validated and CORS is restricted. The limitations:
- one small topology;
- hand-set weights;
- an idealised attacker;
- a heuristic that ignores redundancy;
- real issues like decoy fingerprinting and false positives aren't modelled."

### 21 · Future scope (0:20)
"Next steps:
- realistic, directed networks;
- exact or game-theoretic placement;
- proper benchmarks without chokepoints;
- machine learning only if real labelled data exists."

### 22 · Conclusion (0:25)
"To conclude: the defender's honeypot decision is computed from the attacker's own predicted routes, and every number can be explained and is tested. Thank you. I'm happy to take questions."

---

## Terms to pronounce and explain

| Term | Say | One-line meaning |
|---|---|---|
| Heuristic | hyoo-RIS-tik | A rule of thumb that guides a search |
| Admissible | ad-MISS-ible | A heuristic that never overestimates the remaining cost |
| A\* | "A-star" | f = g + h search |
| Dijkstra | DIKE-struh | The shortest-path algorithm UCS is based on |
| Minimax | MIN-ee-max | Search for a two-player game |
| Alpha-Beta | — | Minimax with pruning; same answer, fewer nodes |
| Bayesian | BAY-zee-an | Updating a probability with evidence |
| STRIPS | "strips" | A planning formalism: preconditions, add and delete lists |
| Lateral movement | — | Moving between hosts inside a network |
| Chokepoint | — | A node every route must pass through |

---

## Questions to expect *during* the talk
- "Is this real or simulated?" → "Simulated: a synthetic network, nothing deployed."
- "Where is the AI?" → Slide 13: classical AI, no ML.
- "Why is A\* no better than UCS?" → "The heuristic is weak: hop count × 1, while the real costs are 2–5."
- "Why 100%?" → "The chokepoint at the Web Server." (slide 19)
- "Can I see it running?" → Go to the demo (Viva Guide, Part I).

## Handling interruptions
1. Stop, listen to the whole question, and repeat the key words back ("So you're asking why UCS stops at pop, not push…").
2. Answer in one or two sentences, then point to where it's covered ("…and that's on slide 10 if you'd like the trace").
3. If it belongs to a later slide, say "Great question. I cover that in two slides; may I answer it there?" Then remember to do it.
4. If it needs detail, open a backup slide (24–31).

## Answering honestly when something isn't implemented
Use a three-part pattern: **state the fact → what exists instead → how you'd add it.**
- "No, there's no machine-learning model. What exists is graph search plus a transparent score. With labelled data from an authorised lab, I'd train a model and compare it against these baselines."
- "No, it isn't deployed to the cloud. Render and Vercel config files exist, but I've only verified the local and Docker setups."
- "No, the probabilities aren't measured. They're documented assumptions in ai/bayesian.py."

Never improvise a feature, number or citation. "I haven't measured that" is a good answer.

## Closing statement (memorise this one)
"My project shows that honeypot placement can be computed, explained and tested: the defender decides using the attacker's own predicted routes. It's a simulation with clear limits, and I've tried to be precise about exactly what it does and doesn't do. Thank you."
