import tkinter as tk
from tkinter import scrolledtext, messagebox
import random
import json
from openai import OpenAI
from pydantic import RootModel, ValidationError
from typing import Dict

# Set up OpenAI client
client = OpenAI(base_url="http://localhost:1234/v1", api_key="lm-studio")

# Define the Pydantic model for validation
class DnDResponseSchema(RootModel[Dict[str, str]]):
    def validate_keys(self):
        expected_keys = {str(i) for i in range(1, 7)}
        actual_keys = set(self.root.keys())
        if expected_keys != actual_keys:
            raise ValueError(f"Expected keys {expected_keys}, got {actual_keys}")

class SuggestionsSchema(RootModel[Dict[str, str]]):
    def validate_keys(self):
        expected_keys = {"1", "2", "3"}
        actual_keys = set(self.root.keys())
        if expected_keys != actual_keys:
            raise ValueError(f"Expected keys {expected_keys}, got {actual_keys}")

class DnDGameInterface:
    def __init__(self, root):
        self.root = root
        self.root.title("D&D Game Interface")
        self.root.geometry("800x700")
        
        self.game_history = []
        self.current_outcomes = {}
        self.current_roll = None
        self.last_action = ""
        
        # Create frames
        self.create_widgets()
        self.layout_widgets()
    
    def create_widgets(self):
        # Create main frames
        self.history_frame = tk.Frame(self.root)
        self.input_frame = tk.Frame(self.root)
        self.suggestions_frame = tk.Frame(self.root)
        
        # Game history text area
        self.context_label = tk.Label(self.history_frame, text="Game History:")
        self.context_box = scrolledtext.ScrolledText(
            self.history_frame,
            wrap=tk.WORD,
            width=80,
            height=20
        )
        self.context_box.config(state=tk.DISABLED)
        
        # User input area
        self.input_label = tk.Label(self.input_frame, text="Your Action:")
        self.user_input = scrolledtext.ScrolledText(
            self.input_frame,
            wrap=tk.WORD,
            width=80,
            height=5
        )
        
        # Buttons
        self.button_frame = tk.Frame(self.input_frame)
        self.send_button = tk.Button(
            self.button_frame,
            text="Send",
            command=self.on_send_clicked,
            bg="#4CAF50",
            fg="white",
            width=10
        )
        self.reroll_button = tk.Button(
            self.button_frame,
            text="Reroll",
            command=self.on_reroll_clicked,
            bg="#FF9800",
            fg="white",
            width=10
        )
        
        # Suggestions
        self.suggestions_label = tk.Label(self.suggestions_frame, text="Suggested Actions:")
        self.suggestion_buttons = []
        for i in range(1, 4):
            button = tk.Button(
                self.suggestions_frame,
                text=f"Suggested Action {i}",
                command=lambda i=i: self.on_suggestion_clicked(i),
                width=70,
                anchor="w"
            )
            self.suggestion_buttons.append(button)
    
    def layout_widgets(self):
        # Layout history frame
        self.history_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        self.context_label.pack(anchor="w")
        self.context_box.pack(fill=tk.BOTH, expand=True)
        
        # Layout input frame
        self.input_frame.pack(fill=tk.BOTH, padx=10, pady=5)
        self.input_label.pack(anchor="w")
        self.user_input.pack(fill=tk.BOTH, expand=True)
        
        # Layout buttons
        self.button_frame.pack(fill=tk.X, pady=5)
        self.send_button.pack(side=tk.LEFT, padx=5)
        self.reroll_button.pack(side=tk.LEFT, padx=5)
        
        # Layout suggestions
        self.suggestions_frame.pack(fill=tk.BOTH, padx=10, pady=10)
        self.suggestions_label.pack(anchor="w")
        for button in self.suggestion_buttons:
            button.pack(fill=tk.X, pady=2)
    
    def update_context(self, content, replace_last=False):
        if replace_last and self.game_history:
            self.game_history.pop()
        self.game_history.append(content)
        
        # Update the text widget
        self.context_box.config(state=tk.NORMAL)
        self.context_box.delete(1.0, tk.END)
        self.context_box.insert(tk.END, "\n\n".join(self.game_history))
        self.context_box.config(state=tk.DISABLED)
        self.context_box.see(tk.END)  # Scroll to the end
        
    def update_suggestions(self, suggestions):
        for i, button in enumerate(self.suggestion_buttons):
            button.config(text=suggestions[str(i+1)])
    
    def roll_die(self):
        return random.randint(1, 6)
    
    def get_model_response(self, user_action):
        system_prompt = """
        You are a fantasy roleplaying assistant. Your task is to return 6 different interpretations or outcomes of a user's in-game action.
        The replies will be from failure to success with the lowest being failure, and the highest success.
        
        Respond ONLY in JSON format, using the following schema:
        {
          "1": "An epic and funny failure.",
          "2": "The request fails perhaps the opposite effect the user wanted.",
          "3": "The action was not successful but the outcome is neutral",
          "4": "A fair success",
          "5": "An elegant success",
          "6": "an amazing success"
        }
        
        Here's an example for the action "I try to climb the tower":
        {
          "1": "You slip on the first foothold and fall flat on your back, knocking the wind out of yourself as nearby creatures snicker at your clumsiness.",
          "2": "Your aggressive climbing causes several loose stones to break free. They crash down around you, alerting the tower guards to your presence.",
          "3": "After several attempts, you realize the tower's surface is too smooth to climb without proper equipment. You're back where you started.",
          "4": "With careful movements, you manage to scale about halfway up the tower, finding a small window ledge where you can rest and observe.",
          "5": "Your nimble fingers find perfect handholds in the weathered stone, allowing you to scale the tower with remarkable speed and silence.",
          "6": "Not only do you scale the tower effortlessly, but you discover a hidden entrance near the top that appears to have been unused for centuries."
        }
        
        Each response should be a short narrative or description (1–3 sentences), styled as if spoken by a dungeon master. Keep it creative and immersive.
        """
        
        try:
            completion = client.chat.completions.create(
                model="model-identifier",  # Replace with your actual model name
                messages=[
                    {"role": "system", "content": system_prompt.strip()},
                    {"role": "user", "content": f"My action: {user_action}"}
                ],
                temperature=0.8,
            )
            
            response_text = completion.choices[0].message.content.strip()
            
            # Check if the JSON is properly formatted (has matching braces)
            if response_text.count('{') != response_text.count('}'):
                # Try to fix it by adding missing closing brace
                response_text = response_text + "}"
                
            try:
                return json.loads(response_text)
            except json.JSONDecodeError as e:
                messagebox.showerror("JSON Error", f"Failed to parse model response: {str(e)}\n\nRaw response: {response_text}")
                # Return a fallback dictionary
                return {str(i): f"Error parsing outcome {i}" for i in range(1, 7)}
        except Exception as e:
            messagebox.showerror("Error", f"Failed to get model response: {str(e)}")
            return {str(i): f"Error getting outcome {i}" for i in range(1, 7)}
    
    def get_suggestions(self, context):
        system_prompt = """
        You are a fantasy roleplaying assistant.
Maintain the world's internal logic and consistency Based on the provided game context, suggest 3 different possible actions the player might want to take next.
        
        Respond ONLY in JSON format, using the following schema:
        {
          "1": "A possible action described in 5-10 words",
          "2": "A possible action described in 5-10 words",
          "3": "A possible action described in 5-10 words"
        }
        
        Here's an example for a context where the player just entered a tavern:
        {
          "1": "Order a drink from the bartender",
          "2": "Ask locals about recent rumors",
          "3": "Look for suspicious characters"
        }
        
        And another example for combat context:
        {
          "1": "Attack with your sword",
          "2": "Take cover behind the boulder",
          "3": "Try to negotiate with the enemy"
        }
        
        Make the suggestions creative, varied, and appropriate to the current situation.
        """
        
        try:
            completion = client.chat.completions.create(
                model="model-identifier",  # Replace with your actual model name
                messages=[
                    {"role": "system", "content": system_prompt.strip()},
                    {"role": "user", "content": f"Game context: {context}\n\nSuggest three possible actions for the player:"}
                ],
                temperature=0.9,
            )
            
            response_text = completion.choices[0].message.content.strip()
            
            # Check if the JSON is properly formatted (has matching braces)
            if response_text.count('{') != response_text.count('}'):
                # Try to fix it by adding missing closing brace
                response_text = response_text + "}"
                
            try:
                return json.loads(response_text)
            except json.JSONDecodeError as e:
                messagebox.showerror("JSON Error", f"Failed to parse model response: {str(e)}\n\nRaw response: {response_text}")
                # Return a fallback dictionary
                return {str(i): f"Error parsing outcome {i}" for i in range(1, 7)}
        except Exception as e:
            messagebox.showerror("Error", f"Failed to get suggestions: {str(e)}")
            return {str(i): f"Suggested action {i}" for i in range(1, 4)}
    
    def on_send_clicked(self):
        user_action = self.user_input.get("1.0", tk.END).strip()
        if not user_action:
            return
            
        self.last_action = user_action
        self.update_context(f"Player: {user_action}")
        
        try:
            # Show loading indicator in the UI
            self.root.config(cursor="watch")
            self.root.update()
            
            # Get 6 possible outcomes from model
            self.current_outcomes = self.get_model_response(user_action)
            
            # Roll die and get outcome
            self.current_roll = self.roll_die()
            outcome = self.current_outcomes[str(self.current_roll)]
            
            # Update game context
            self.update_context(f"DM [Rolled {self.current_roll}]: {outcome}")
            
            # Clear user input
            self.user_input.delete("1.0", tk.END)
            
            # Get suggestions for next actions
            full_context = "\n\n".join(self.game_history)
            suggestions = self.get_suggestions(full_context)
            self.update_suggestions(suggestions)
            
        except Exception as e:
            self.update_context(f"Error: {str(e)}")
        finally:
            # Reset cursor
            self.root.config(cursor="")
    
    def on_reroll_clicked(self):
        if not self.current_outcomes:
            return
            
        # Roll again
        old_roll = self.current_roll
        self.current_roll = self.roll_die()
        while self.current_roll == old_roll and len(self.current_outcomes) > 1:
            self.current_roll = self.roll_die()
            
        outcome = self.current_outcomes[str(self.current_roll)]
        
        # Update game context (replace last entry)
        self.update_context(f"DM [Rolled {self.current_roll}]: {outcome}", replace_last=True)
    
    def on_suggestion_clicked(self, suggestion_number):
        suggestion = self.suggestion_buttons[suggestion_number-1]["text"]
        self.user_input.delete("1.0", tk.END)
        self.user_input.insert(tk.END, suggestion)
        # Set focus to the text widget and place cursor at the end
        self.user_input.focus_set()
        self.user_input.see(tk.END)

def main():
    root = tk.Tk()
    app = DnDGameInterface(root)
    root.mainloop()

if __name__ == "__main__":
    main()