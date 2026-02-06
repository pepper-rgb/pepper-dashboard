import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const WORKSPACE_PATH = process.env.OPENCLAW_WORKSPACE || '/Users/pepperstarke/.openclaw/workspace'
const TASKS_FILE = path.join(WORKSPACE_PATH, 'dashboard-tasks.json')

interface Task {
  id: string
  text: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  details?: string
  createdAt: string
  source?: 'memory' | 'manual'
}

// Parse the todo markdown file
async function parseMemoryTodo(): Promise<Task[]> {
  const today = new Date().toISOString().split('T')[0]
  const todoPath = path.join(WORKSPACE_PATH, 'memory', `todo-${today}.md`)
  
  try {
    const content = await fs.readFile(todoPath, 'utf-8')
    const tasks: Task[] = []
    
    const lines = content.split('\n')
    let currentSection = ''
    let currentTask: Partial<Task> | null = null
    
    for (const line of lines) {
      // Section headers
      if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '').trim()
        continue
      }
      
      // Task headers (### Name)
      if (line.startsWith('### ')) {
        if (currentTask && currentTask.text) {
          tasks.push(currentTask as Task)
        }
        
        const taskName = line.replace('### ', '').trim()
        const isFollowUp = currentSection.toLowerCase().includes('follow-up')
        
        currentTask = {
          id: `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: taskName,
          completed: false,
          priority: isFollowUp ? 'medium' : 'low',
          details: '',
          createdAt: new Date().toISOString(),
          source: 'memory'
        }
        continue
      }
      
      // Details under current task
      if (currentTask && line.startsWith('- **')) {
        const detailLine = line.replace(/^- \*\*([^*]+)\*\*:?\s*/, '$1: ')
        currentTask.details = (currentTask.details || '') + detailLine + '\n'
        
        // Check for priority indicators
        if (line.toLowerCase().includes('critical') || line.toLowerCase().includes('urgent')) {
          currentTask.priority = 'high'
        }
        if (line.toLowerCase().includes('action needed')) {
          currentTask.priority = 'medium'
        }
      }
    }
    
    // Don't forget the last task
    if (currentTask && currentTask.text) {
      tasks.push(currentTask as Task)
    }
    
    return tasks
  } catch (error) {
    // File doesn't exist, return empty
    return []
  }
}

// Load saved tasks from JSON
async function loadSavedTasks(): Promise<Task[]> {
  try {
    const content = await fs.readFile(TASKS_FILE, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

// Save tasks to JSON
async function saveTasks(tasks: Task[]): Promise<void> {
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2))
}

export async function GET() {
  try {
    const [memoryTasks, savedTasks] = await Promise.all([
      parseMemoryTodo(),
      loadSavedTasks()
    ])
    
    // Merge: saved tasks take precedence, add new memory tasks
    const savedIds = new Set(savedTasks.map(t => t.text.toLowerCase()))
    const newMemoryTasks = memoryTasks.filter(t => !savedIds.has(t.text.toLowerCase()))
    
    const allTasks = [...savedTasks, ...newMemoryTasks]
    
    return NextResponse.json({
      tasks: allTasks,
      sources: {
        memory: memoryTasks.length,
        saved: savedTasks.length
      }
    })
  } catch (error) {
    console.error('Error loading tasks:', error)
    return NextResponse.json({ tasks: [], error: 'Failed to load tasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { task } = body
    
    if (!task || !task.text) {
      return NextResponse.json({ error: 'Task text is required' }, { status: 400 })
    }
    
    const tasks = await loadSavedTasks()
    
    const newTask: Task = {
      id: `manual-${Date.now()}`,
      text: task.text,
      completed: false,
      priority: task.priority || 'medium',
      details: task.details || '',
      createdAt: new Date().toISOString(),
      source: 'manual'
    }
    
    tasks.push(newTask)
    await saveTasks(tasks)
    
    return NextResponse.json({ task: newTask, success: true })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, updates } = body
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }
    
    const tasks = await loadSavedTasks()
    const taskIndex = tasks.findIndex(t => t.id === id)
    
    if (taskIndex === -1) {
      // Task from memory, add to saved with updates
      const newTask: Task = {
        id,
        text: updates.text || '',
        completed: updates.completed || false,
        priority: updates.priority || 'medium',
        details: updates.details || '',
        createdAt: new Date().toISOString(),
        source: 'manual'
      }
      tasks.push(newTask)
    } else {
      tasks[taskIndex] = { ...tasks[taskIndex], ...updates }
    }
    
    await saveTasks(tasks)
    
    return NextResponse.json({ success: true, task: tasks[taskIndex] || updates })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }
    
    const tasks = await loadSavedTasks()
    const filteredTasks = tasks.filter(t => t.id !== id)
    await saveTasks(filteredTasks)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
