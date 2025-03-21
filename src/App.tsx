import React, { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Paper,
  Container,
  AppBar,
  Toolbar,
  Snackbar,
  Alert,
  Avatar,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import SaveIcon from '@mui/icons-material/Save';
import GitHubIcon from '@mui/icons-material/GitHub';
import { Octokit } from '@octokit/rest';

interface Task {
  id: number;
  text: string;
  completed: boolean;
}

interface User {
  username: string;
  password: string;
}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
  format: 'json' | 'yaml';
}

const LOCAL_STORAGE_KEY = "tasks";
const USER_STORAGE_KEY = "user_logged_in";
const GITHUB_CONFIG_KEY = "github_config";

// Hardcoded credentials
const ADMIN_USER: User = {
  username: "admin",
  password: "admin"
};

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskText, setTaskText] = useState("");
  const [isInitialRender, setIsInitialRender] = useState(true);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info" | "warning">("success");
  
  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // GitHub integration
  const [githubConfigOpen, setGithubConfigOpen] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubPath, setGithubPath] = useState("tasks.json");
  const [githubFormat, setGithubFormat] = useState<'json' | 'yaml'>('json');
  const [isGithubConfigured, setIsGithubConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if user was previously logged in and load GitHub config
  useEffect(() => {
    const loggedInStatus = localStorage.getItem(USER_STORAGE_KEY);
    if (loggedInStatus === "true") {
      setIsLoggedIn(true);
    }

    const savedGithubConfig = localStorage.getItem(GITHUB_CONFIG_KEY);
    if (savedGithubConfig) {
      try {
        const config: GitHubConfig = JSON.parse(savedGithubConfig);
        setGithubToken(config.token);
        setGithubOwner(config.owner);
        setGithubRepo(config.repo);
        setGithubPath(config.path);
        setGithubFormat(config.format);
        setIsGithubConfigured(true);
      } catch (error) {
        console.error("Error parsing GitHub config:", error);
      }
    }
  }, []);

  // Load tasks on startup - first try GitHub, then fallback to localStorage
  useEffect(() => {
    if (isLoggedIn) {
      // If GitHub is configured, load from there first
      if (isGithubConfigured) {
        loadTasksFromGithub();
      } else {
        // Fallback to localStorage if GitHub isn't configured
        loadTasksFromLocalStorage();
      }
    }
    setIsInitialRender(false);
  }, [isLoggedIn, isGithubConfigured]);

  // Helper function to load tasks from localStorage
  const loadTasksFromLocalStorage = () => {
    const storedTasks = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedTasks) {
      try {
        setTasks(JSON.parse(storedTasks));
      } catch (error) {
        console.error("Error parsing tasks from localStorage:", error);
        localStorage.removeItem(LOCAL_STORAGE_KEY); // Reset if corrupted
        showSnackbar("Error loading tasks. Storage has been reset.", "error");
      }
    }
  };

  // Save tasks to localStorage whenever they change, but skip the first render
  useEffect(() => {
    if (!isInitialRender && isLoggedIn) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tasks));
    }
  }, [tasks, isInitialRender, isLoggedIn]);

  const showSnackbar = (message: string, severity: "success" | "error" | "info" | "warning") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setOpenSnackbar(true);
  };

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  const handleLogin = () => {
    if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
      setIsLoggedIn(true);
      localStorage.setItem(USER_STORAGE_KEY, "true");
      showSnackbar("Login successful", "success");
      setLoginError("");
    } else {
      setLoginError("Invalid username or password");
      showSnackbar("Login failed", "error");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem(USER_STORAGE_KEY);
    showSnackbar("Logged out successfully", "info");
    setUsername("");
    setPassword("");
  };

  const handleKeyPressLogin = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const addTask = () => {
    if (taskText.trim() === "") return;
    const newTask: Task = {
      id: Date.now(),
      text: taskText,
      completed: false,
    };
    setTasks([...tasks, newTask]);
    setTaskText("");
    showSnackbar("Task added successfully!", "success");
  };

  const toggleTask = (id: number) => {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
    const taskCompleted = tasks.find(task => task.id === id)?.completed;
    showSnackbar(
      taskCompleted ? "Task marked as incomplete" : "Task completed!", 
      "info"
    );
  };

  const deleteTask = (id: number) => {
    setTasks(tasks.filter((task) => task.id !== id));
    showSnackbar("Task deleted", "info");
  };

  const handleKeyPressTask = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTask();
    }
  };

  // GitHub Integration Functions
  const openGithubConfig = () => {
    setGithubConfigOpen(true);
  };

  const closeGithubConfig = () => {
    setGithubConfigOpen(false);
  };

  const saveGithubConfig = () => {
    const config: GitHubConfig = {
      token: githubToken,
      owner: githubOwner,
      repo: githubRepo,
      path: githubPath || 'tasks.json',
      format: githubFormat
    };
    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(config));
    setIsGithubConfigured(true);
    closeGithubConfig();
    showSnackbar("GitHub configuration saved", "success");
    
    // Load tasks from GitHub after configuring
    loadTasksFromGithub();
  };

  const convertTasksToContent = (tasks: Task[]): string => {
    if (githubFormat === 'json') {
      return JSON.stringify(tasks, null, 2);
    } else {
      // Simple YAML conversion
      let yaml = 'tasks:\n';
      tasks.forEach(task => {
        yaml += `  - id: ${task.id}\n`;
        yaml += `    text: ${task.text}\n`;
        yaml += `    completed: ${task.completed}\n`;
      });
      return yaml;
    }
  };

  const parseContentToTasks = (content: string): Task[] => {
    try {
      if (githubFormat === 'json') {
        return JSON.parse(content);
      } else {
        // This is a simplified YAML parser and would need a real YAML library in production
        const tasks: Task[] = [];
        const lines = content.split('\n');
        let currentTask: Partial<Task> = {};
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('- id:')) {
            if (Object.keys(currentTask).length > 0) {
              tasks.push(currentTask as Task);
            }
            currentTask = {};
            currentTask.id = parseInt(line.split(':')[1].trim());
          } else if (line.startsWith('text:')) {
            currentTask.text = line.split(':')[1].trim();
          } else if (line.startsWith('completed:')) {
            currentTask.completed = line.split(':')[1].trim() === 'true';
          }
        }
        
        if (Object.keys(currentTask).length > 0) {
          tasks.push(currentTask as Task);
        }
        
        return tasks;
      }
    } catch (error) {
      console.error("Error parsing content:", error);
      throw error;
    }
  };

  const saveTasksToGithub = async () => {
    if (!isGithubConfigured) {
      showSnackbar("Please configure GitHub settings first", "warning");
      openGithubConfig();
      return;
    }

    setIsLoading(true);
    try {
      const octokit = new Octokit({ auth: githubToken });
      const content = convertTasksToContent(tasks);
      
      // Check if file exists
      let sha;
      try {
        const { data } = await octokit.repos.getContent({
          owner: githubOwner,
          repo: githubRepo,
          path: githubPath
        });
        
        if ('sha' in data) {
          sha = data.sha;
        }
      } catch (error) {
        // File doesn't exist yet, will be created
      }
      
      // Create or update file
      await octokit.repos.createOrUpdateFileContents({
        owner: githubOwner,
        repo: githubRepo,
        path: githubPath,
        message: `Update tasks - ${new Date().toISOString()}`,
        content: btoa(content),
        sha
      });
      
      showSnackbar("Tasks saved to GitHub successfully", "success");
    } catch (error) {
      console.error("Error saving to GitHub:", error);
      showSnackbar("Failed to save tasks to GitHub", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadTasksFromGithub = async () => {
    if (!isGithubConfigured) {
      // Silently fall back to localStorage if GitHub isn't configured
      loadTasksFromLocalStorage();
      return;
    }

    setIsLoading(true);
    try {
      const octokit = new Octokit({ auth: githubToken });
      
      const { data } = await octokit.repos.getContent({
        owner: githubOwner,
        repo: githubRepo,
        path: githubPath
      });
      
      if ('content' in data && 'encoding' in data) {
        const content = atob(data.content);
        const loadedTasks = parseContentToTasks(content);
        setTasks(loadedTasks);
        showSnackbar("Tasks loaded from GitHub successfully", "success");
      }
    } catch (error) {
      console.error("Error loading from GitHub:", error);
      // Fall back to localStorage if GitHub load fails
      loadTasksFromLocalStorage();
      // Only show error if we have a GitHub config but couldn't load
      if (isGithubConfigured) {
        showSnackbar("Couldn't load from GitHub, loaded from local storage instead", "warning");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const completedTasks = tasks.filter(task => task.completed);
  const incompleteTasks = tasks.filter(task => !task.completed);

  // Login Page
  if (!isLoggedIn) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" sx={{ marginBottom: 4 }}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Task Manager
            </Typography>
          </Toolbar>
        </AppBar>
        
        <Container component="main" maxWidth="xs">
          <Box
            sx={{
              marginTop: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Avatar sx={{ m: 1, bgcolor: 'primary.main' }}>
              <LockOutlinedIcon />
            </Avatar>
            <Typography component="h1" variant="h5">
              Sign in
            </Typography>
            <Box sx={{ mt: 1 }}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={handleKeyPressLogin}
                error={!!loginError}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPressLogin}
                error={!!loginError}
                helperText={loginError}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                onClick={handleLogin}
                disabled={!username || !password}
              >
                Sign In
              </Button>
              <Grid container>
                <Grid item xs>
                  <Typography variant="body2" color="text.secondary">
                    Default credentials: admin/admin
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </Container>

        <Snackbar 
          open={openSnackbar} 
          autoHideDuration={3000} 
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  // Task Manager Page (after login)
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ marginBottom: 4 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Task Manager
          </Typography>
          <Button 
            color="inherit" 
            onClick={openGithubConfig}
            startIcon={<GitHubIcon />}
            sx={{ mr: 1 }}
          >
            GitHub Config
          </Button>
          <Button 
            color="inherit" 
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="sm">
        <Paper elevation={3} sx={{ padding: 3, marginBottom: 3 }}>
          <Box sx={{ display: 'flex', marginBottom: 2 }}>
            <TextField
              fullWidth
              variant="outlined"
              label="Add a task"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyPress={handleKeyPressTask}
              size="small"
              sx={{ marginRight: 1 }}
            />
            <Button 
              variant="contained" 
              color="primary" 
              onClick={addTask}
              startIcon={<AddIcon />}
              disabled={taskText.trim() === ""}
            >
              Add
            </Button>
          </Box>

          {/* Single GitHub save button */}
          {isGithubConfigured && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 2 }}>
              <Button 
                variant="outlined" 
                color="primary" 
                startIcon={<SaveIcon />}
                onClick={saveTasksToGithub}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : "Save Changes"}
              </Button>
            </Box>
          )}

          {incompleteTasks.length > 0 && (
            <>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Tasks
              </Typography>
              <Paper elevation={1} sx={{ mb: 3 }}>
                <List>
                  {incompleteTasks.map((task) => (
                    <ListItem key={task.id} divider>
                      <ListItemIcon onClick={() => toggleTask(task.id)} sx={{ cursor: 'pointer' }}>
                        <RadioButtonUncheckedIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={task.text} 
                        onClick={() => toggleTask(task.id)}
                        sx={{ cursor: 'pointer' }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => deleteTask(task.id)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </>
          )}

          {completedTasks.length > 0 && (
            <>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Completed
              </Typography>
              <Paper elevation={1}>
                <List>
                  {completedTasks.map((task) => (
                    <ListItem key={task.id} divider sx={{ opacity: 0.7 }}>
                      <ListItemIcon onClick={() => toggleTask(task.id)} sx={{ cursor: 'pointer' }}>
                        <CheckCircleOutlineIcon color="success" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={task.text} 
                        onClick={() => toggleTask(task.id)}
                        sx={{ 
                          textDecoration: 'line-through',
                          cursor: 'pointer'
                        }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => deleteTask(task.id)} color="error">
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </>
          )}

          {tasks.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No tasks yet. Add a task to get started!
              </Typography>
            </Box>
          )}
        </Paper>
      </Container>

      {/* GitHub Configuration Dialog */}
      <Dialog open={githubConfigOpen} onClose={closeGithubConfig}>
        <DialogTitle>GitHub Configuration</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="token"
            label="GitHub Personal Access Token"
            type="password"
            fullWidth
            variant="outlined"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            required
          />
          <TextField
            margin="dense"
            id="owner"
            label="Repository Owner"
            type="text"
            fullWidth
            variant="outlined"
            value={githubOwner}
            onChange={(e) => setGithubOwner(e.target.value)}
            required
          />
          <TextField
            margin="dense"
            id="repo"
            label="Repository Name"
            type="text"
            fullWidth
            variant="outlined"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            required
          />
          <TextField
            margin="dense"
            id="path"
            label="File Path"
            type="text"
            fullWidth
            variant="outlined"
            value={githubPath}
            onChange={(e) => setGithubPath(e.target.value)}
            placeholder="tasks.json or tasks.yaml"
            required
          />
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>File Format:</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant={githubFormat === 'json' ? "contained" : "outlined"} 
                onClick={() => setGithubFormat('json')}
              >
                JSON
              </Button>
              <Button 
                variant={githubFormat === 'yaml' ? "contained" : "outlined"} 
                onClick={() => setGithubFormat('yaml')}
              >
                YAML
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeGithubConfig}>Cancel</Button>
          <Button 
            onClick={saveGithubConfig}
            disabled={!githubToken || !githubOwner || !githubRepo}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={openSnackbar} 
        autoHideDuration={3000} 
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default App;