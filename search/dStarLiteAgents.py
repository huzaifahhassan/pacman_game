# dStarLiteAgents.py
# ------------------
# Licensing Information:  You are free to use or extend these projects for
# educational purposes provided that (1) you do not distribute or publish
# solutions, (2) you retain this notice, and (3) you provide clear
# attribution to UC Berkeley, including a link to http://ai.berkeley.edu.
#
# Attribution Information: The Pacman AI projects were developed at UC Berkeley.
# Q9 (D* Lite in partially known mazes) added for CS-860 Artificial
# Intelligence, NUST.


"""
Agents and supporting classes for Q9 (D* Lite).

In Q9 Pacman does NOT know where the walls are. He knows only the size of the
board, his own position and the position of the food. He plans under the
FREESPACE ASSUMPTION (every cell he has not yet observed is assumed to be
open), and a short-range sensor reveals the true contents of the cells around
him after every move. Whenever the sensor reveals a wall that he did not know
about, the edge costs of his graph change and he must replan.

    DStarLiteAgent        replans incrementally with your D* Lite (dStarLite.py)
    ReplanningAStarAgent  replans from scratch with your A* (search.py, Q4);
                          provided for comparison

You should read this file, but you do not need to change anything in it.
"""

import time
import util
import search
import dStarLite
from game import Agent, Directions, Actions

INF = float('inf')


def findGoal(gameState):
    """The goal is the single food dot in the maze."""
    food = gameState.getFood().asList()
    if len(food) != 1:
        print('Warning: Q9 layouts should contain exactly one food dot; using the first.')
    return food[0]


class GridBelief:
    """
    Pacman's knowledge of the maze.

    The belief starts with NO walls (freespace assumption). Calling
    sense(cell) reveals the true contents of every cell within
    `sensorRadius` of `cell` (a square window, i.e. Chebyshev distance) and
    returns the list of cells that have just been discovered to be walls.

    Planners must only use the following methods:
        neighbors(s)    the (up to four) in-bounds cells adjacent to s, in the
                        order North, South, East, West. Neighbourhood never
                        changes; only edge COSTS change.
        cost(u, v)      cost of moving between adjacent cells u and v:
                        1 if neither is believed to be a wall, otherwise INF
        isKnownWall(s)  True if s has been observed to be a wall

    Planners must NOT read self._trueWalls -- that would be cheating!
    """

    def __init__(self, trueWalls, sensorRadius=1):
        self._trueWalls = trueWalls
        self.width = trueWalls.width
        self.height = trueWalls.height
        self.sensorRadius = int(sensorRadius)
        self.knownWalls = set()

    def inBounds(self, s):
        return 0 <= s[0] < self.width and 0 <= s[1] < self.height

    def neighbors(self, s):
        x, y = s
        result = []
        for n in ((x, y + 1), (x, y - 1), (x + 1, y), (x - 1, y)):
            if self.inBounds(n):
                result.append(n)
        return result

    def isKnownWall(self, s):
        return s in self.knownWalls

    def cost(self, u, v):
        if u in self.knownWalls or v in self.knownWalls:
            return INF
        return 1

    def sense(self, s):
        x, y = s
        r = self.sensorRadius
        discovered = []
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                c = (x + dx, y + dy)
                if self.inBounds(c) and self._trueWalls[c[0]][c[1]] and c not in self.knownWalls:
                    self.knownWalls.add(c)
                    discovered.append(c)
        return discovered


def _drawCells(cells):
    import __main__
    if '_display' in dir(__main__) and 'drawExpandedCells' in dir(__main__._display):
        __main__._display.drawExpandedCells(cells)


class DStarLiteAgent(Agent):
    """
    Navigates to the food in an initially unknown maze using D* Lite.

    Options (pass with -a):  radius=<sensor radius, default 1>

    The red overlay shows the cells expanded during the MOST RECENT planning
    episode (brighter = expanded earlier). Watch how small it is after each
    replan compared with the first plan.
    """

    def __init__(self, radius='1'):
        self.radius = int(radius)

    def registerInitialState(self, state):
        self.startTime = time.time()
        self.goal = findGoal(state)
        self.belief = GridBelief(state.getWalls(), self.radius)
        start = state.getPacmanPosition()
        self.belief.sense(start)
        util.DStarLitePriorityQueue.resetCounters()
        self.planner = dStarLite.DStarLite(self.belief, start, self.goal)
        self.planner.computeShortestPath()
        self.initialExpansions = util.DStarLitePriorityQueue.totalPops
        self.replans = 0
        self.steps = 0
        _drawCells(list(util.DStarLitePriorityQueue.poppedHistory))
        print('[DStarLiteAgent] initial plan: %d expansions, estimated cost %s'
              % (self.initialExpansions, self.planner.getG(start)))

    def getAction(self, state):
        pos = state.getPacmanPosition()
        self.planner.sStart = pos
        discovered = self.belief.sense(pos)
        if discovered:
            util.DStarLitePriorityQueue.resetHistory()
            self.planner.updateEdgeCosts(discovered)
            self.replans += 1
            _drawCells(list(util.DStarLitePriorityQueue.poppedHistory))

        nxt = self.planner.nextStep()
        if nxt is None:
            if pos != self.goal:
                print('[DStarLiteAgent] No path to the goal exists given current knowledge.')
                print('[DStarLiteAgent] %d total expansions.' % util.DStarLitePriorityQueue.totalPops)
                import sys
                sys.exit(0)
            return Directions.STOP

        action = Actions.vectorToDirection((nxt[0] - pos[0], nxt[1] - pos[1]))
        if action not in state.getLegalPacmanActions():
            raise Exception('DStarLiteAgent tried an illegal move from %s to %s' % (str(pos), str(nxt)))
        self.steps += 1
        if nxt == self.goal:
            self._report()
        return action

    def _report(self):
        total = util.DStarLitePriorityQueue.totalPops
        print('[DStarLiteAgent] reached goal in %d steps, %d replanning episodes, '
              '%d total expansions (%d initial + %d during replanning), %.2f s'
              % (self.steps, self.replans, total, self.initialExpansions,
                 total - self.initialExpansions, time.time() - self.startTime))


class BeliefPositionProblem(search.SearchProblem):
    """Path-finding problem on Pacman's CURRENT belief of the maze."""

    def __init__(self, belief, start, goal):
        self.belief = belief
        self.start = start
        self.goal = goal
        self._expanded = 0

    def getStartState(self):
        return self.start

    def isGoalState(self, state):
        return state == self.goal

    def getSuccessors(self, state):
        self._expanded += 1
        successors = []
        for n in self.belief.neighbors(state):
            if self.belief.cost(state, n) < INF:
                action = Actions.vectorToDirection((n[0] - state[0], n[1] - state[1]))
                successors.append((n, action, 1))
        return successors

    def getCostOfActions(self, actions):
        return len(actions)


class ReplanningAStarAgent(Agent):
    """
    Baseline for comparison: plans with YOUR aStarSearch (Q4) from the current
    cell to the goal on the current belief, follows the plan, and replans from
    scratch whenever a newly discovered wall blocks the remaining plan.

    Options (pass with -a):  radius=<sensor radius, default 1>
    """

    def __init__(self, radius='1'):
        self.radius = int(radius)

    def registerInitialState(self, state):
        self.startTime = time.time()
        self.goal = findGoal(state)
        self.belief = GridBelief(state.getWalls(), self.radius)
        self.belief.sense(state.getPacmanPosition())
        self.totalExpanded = 0
        self.replans = -1
        self.steps = 0
        self._plan(state.getPacmanPosition())

    def _plan(self, pos):
        heuristic = lambda s, problem=None: dStarLite.gridHeuristic(s, self.goal)
        problem = BeliefPositionProblem(self.belief, pos, self.goal)
        actions = search.aStarSearch(problem, heuristic) or []
        self.totalExpanded += problem._expanded
        self.replans += 1
        self.planCells = []
        cell = pos
        for a in actions:
            dx, dy = Actions.directionToVector(a)
            cell = (int(cell[0] + dx), int(cell[1] + dy))
            self.planCells.append(cell)
        self.actions = list(actions)

    def getAction(self, state):
        pos = state.getPacmanPosition()
        discovered = self.belief.sense(pos)
        if discovered and set(discovered) & set(self.planCells):
            self._plan(pos)
        if not self.actions:
            print('[ReplanningAStarAgent] No path to the goal exists given current knowledge.')
            import sys
            sys.exit(0)
        action = self.actions.pop(0)
        self.planCells.pop(0)
        self.steps += 1
        if not self.actions:
            print('[ReplanningAStarAgent] reached goal in %d steps, %d replanning episodes, '
                  '%d total expansions, %.2f s'
                  % (self.steps, self.replans, self.totalExpanded, time.time() - self.startTime))
        return action
