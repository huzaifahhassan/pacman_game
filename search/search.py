# search.py
# ---------
# Licensing Information:  You are free to use or extend these projects for
# educational purposes provided that (1) you do not distribute or publish
# solutions, (2) you retain this notice, and (3) you provide clear
# attribution to UC Berkeley, including a link to http://ai.berkeley.edu.
# 
# Attribution Information: The Pacman AI projects were developed at UC Berkeley.
# The core projects and autograders were primarily created by John DeNero
# (denero@cs.berkeley.edu) and Dan Klein (klein@cs.berkeley.edu).
# Student side autograding was added by Brad Miller, Nick Hay, and
# Pieter Abbeel (pabbeel@cs.berkeley.edu).


"""
In search.py, you will implement generic search algorithms which are called by
Pacman agents (in searchAgents.py).
"""

import util
import time

class SearchProblem:
    """
    This class outlines the structure of a search problem, but doesn't implement
    any of the methods (in object-oriented terminology: an abstract class).

    You do not need to change anything in this class, ever.
    """

    def getStartState(self):
        """
        Returns the start state for the search problem.
        """
        util.raiseNotDefined()

    def isGoalState(self, state):
        """
          state: Search state

        Returns True if and only if the state is a valid goal state.
        """
        util.raiseNotDefined()

    def getSuccessors(self, state):
        """
          state: Search state

        For a given state, this should return a list of triples, (successor,
        action, stepCost), where 'successor' is a successor to the current
        state, 'action' is the action required to get there, and 'stepCost' is
        the incremental cost of expanding to that successor.
        """
        util.raiseNotDefined()

    def getCostOfActions(self, actions):
        """
         actions: A list of actions to take

        This method returns the total cost of a particular sequence of actions.
        The sequence must be composed of legal moves.
        """
        util.raiseNotDefined()


def tinyMazeSearch(problem):
    """
    Returns a sequence of moves that solves tinyMaze.  For any other maze, the
    sequence of moves will be incorrect, so only use this for tinyMaze.
    """
    from game import Directions
    s = Directions.SOUTH
    w = Directions.WEST
    return  [s, s, w, s, w, w, s, w]

def depthFirstSearch(problem: SearchProblem):
    """
    Search the deepest nodes in the search tree first.

    Your search algorithm needs to return a list of actions that reaches the
    goal. Make sure to implement a graph search algorithm.

    To get started, you might want to try some of these simple commands to
    understand the search problem that is being passed in:

    print("Start:", problem.getStartState())
    print("Is the start a goal?", problem.isGoalState(problem.getStartState()))
    print("Start's successors:", problem.getSuccessors(problem.getStartState()))
    """
    "*** YOUR CODE HERE ***"

    # Each stack entry is (state, path), where `path` is the list of actions
    # that leads from the start state to `state`. Carrying the whole path along
    # with the state means we never have to walk back out of a dead end: when we
    # pop an entry we already know exactly how to reach it from the start.
    to_visit = util.Stack()
    to_visit.push((problem.getStartState(), []))

    # Graph search: remember every state we have expanded so that no state is
    # ever expanded twice (this is what stops us looping around cycles).
    visited = set()

    while not to_visit.isEmpty():
        # Take the most recently pushed entry (LIFO), i.e. the deepest node.
        current_state, path = to_visit.pop()

        # A state can be pushed several times before it is popped (reached by
        # different routes). If it was already expanded, skip this duplicate.
        if current_state in visited:
            continue

        # Goal test happens when a node is popped, not when it is pushed. This
        # also covers the case where the start state is already the goal.
        if problem.isGoalState(current_state):
            return path

        visited.add(current_state)

        # Push every unvisited successor together with the path that reaches it.
        # Successors are pushed in the order getSuccessors returns them, so the
        # last one is popped (and explored) first. The step cost is not needed
        # for DFS, so it is ignored.
        for successor, action, _ in problem.getSuccessors(current_state):
            if successor not in visited:
                to_visit.push((successor, path + [action]))

    # The stack ran dry without reaching a goal state: there is no solution.
    return []

def breadthFirstSearch(problem: SearchProblem):
    """Search the shallowest nodes in the search tree first."""
    "*** YOUR CODE HERE ***"

    visited = set()
    path = []
    to_visit = util.Queue()
    current_state = problem.getStartState()

    goal_reached = False
    while not goal_reached:

        successors = problem.getSuccessors(current_state)

        for successor,action,_ in successors:
            if successor not in visited and successor not in [state for state, _ in to_visit.list]:
                to_visit.push((successor , path + [action]))
        print("to visit: " , to_visit.list)

        visited.add(current_state)
        print("visited: " , visited)

        current_state_action = to_visit.pop()
        current_state = current_state_action[0]
        current_action = current_state_action[1]
        path = current_action
        print("current state: " , current_state)
        print("path: " , path)

        if problem.isGoalState(current_state):
            path = current_action
            goal_reached = True
            print("Goal reached!")
            return path

    return path

def uniformCostSearch(problem: SearchProblem):
    """Search the node of least total cost first."""
    "*** YOUR CODE HERE ***"

    # Each heap entry is (state, path, cost): `path` is the list of actions from
    # the start state to `state`, and `cost` is the total step cost of that path.
    # The same number is also the entry's priority, so util.PriorityQueue always
    # pops the cheapest path found so far. Entries with equal cost come out in
    # the order they were pushed, which makes UCS behave like BFS when every
    # step costs 1.
    to_visit = util.PriorityQueue()
    to_visit.push((problem.getStartState(), [], 0), 0)

    # Graph search: remember every state we have expanded so that no state is
    # ever expanded twice.
    visited = set()

    while not to_visit.isEmpty():
        # Take the cheapest entry in the heap.
        current_state, path, cost = to_visit.pop()

        # A state can be in the heap more than once, because a cheaper route to
        # it may be found after a dearer one was already pushed. The cheapest
        # copy is always popped first, so any later copy is a worse duplicate.
        if current_state in visited:
            continue

        # Goal test happens when an entry is popped, not when it is pushed: a
        # cheaper route to the goal might still be waiting in the heap. This
        # also covers the case where the start state is already the goal.
        if problem.isGoalState(current_state):
            return path

        visited.add(current_state)

        # Push every unvisited successor with the path and the total cost that
        # reach it. We must NOT skip a successor that is already waiting in the
        # heap: the new route may be cheaper than the one that is queued.
        for successor, action, step_cost in problem.getSuccessors(current_state):
            if successor not in visited:
                new_cost = cost + step_cost
                to_visit.push((successor, path + [action], new_cost), new_cost)

    # The heap ran dry without reaching a goal state: there is no solution.
    return []

def nullHeuristic(state, problem=None):
    """
    A heuristic function estimates the cost from the current state to the nearest
    goal in the provided SearchProblem.  This heuristic is trivial.
    """
    return 0

def aStarSearch(problem: SearchProblem, heuristic=nullHeuristic):
    """Search the node that has the lowest combined cost and heuristic first."""
    "*** YOUR CODE HERE ***"

    # Each heap entry is (state, path, cost): `path` is the list of actions from
    # the start state to `state`, and `cost` is g, the total step cost of that
    # path. The entry's PRIORITY is f = g + h, where h is the heuristic's
    # estimate of the cost still to go. util.PriorityQueue pops the lowest f
    # first, and entries with equal f come out in the order they were pushed.
    # With heuristic = nullHeuristic, h is always 0, so this is exactly UCS.
    start_state = problem.getStartState()
    to_visit = util.PriorityQueue()
    to_visit.push((start_state, [], 0), heuristic(start_state, problem))

    # Graph search: remember every state we have expanded so that no state is
    # ever expanded twice.
    visited = set()

    while not to_visit.isEmpty():
        # Take the entry with the lowest f = g + h.
        current_state, path, cost = to_visit.pop()

        # A state can be in the heap more than once, because a cheaper route to
        # it may be found after a dearer one was already pushed. The cheaper
        # copy has the lower f and is popped first, so a later copy is a worse
        # duplicate and is skipped.
        if current_state in visited:
            continue

        # Goal test happens when an entry is popped, not when it is pushed: a
        # cheaper route to the goal might still be waiting in the heap. This
        # also covers the case where the start state is already the goal.
        if problem.isGoalState(current_state):
            return path

        visited.add(current_state)

        # Push every unvisited successor with the path and the g that reach it,
        # prioritised by f = g + h. As in UCS we must NOT skip a successor that
        # is already waiting in the heap: the new route may be cheaper.
        for successor, action, step_cost in problem.getSuccessors(current_state):
            if successor not in visited:
                new_cost = cost + step_cost
                priority = new_cost + heuristic(successor, problem)
                to_visit.push((successor, path + [action], new_cost), priority)

    # The heap ran dry without reaching a goal state: there is no solution.
    return []


# Abbreviations
bfs = breadthFirstSearch
dfs = depthFirstSearch
astar = aStarSearch
ucs = uniformCostSearch
