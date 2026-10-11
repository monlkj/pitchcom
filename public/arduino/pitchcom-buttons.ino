// D2: select pitch by press count (1..5, then wrap to 1).
// D3: send selected pitch, then reset. Other buttons are unused.
// Connect each button between its pin and GND. No buzzer needed.
const byte COUNT = 2;
const byte pins[COUNT] = {2, 3};
int lastReading[COUNT];
int stableState[COUNT];
unsigned long changedAt[COUNT];
byte selected = 0;
void setup() {
  Serial.begin(9600);
  for (byte i = 0; i < COUNT; i++) {
    pinMode(pins[i], INPUT_PULLUP);
    lastReading[i] = HIGH;
    stableState[i] = HIGH;
    changedAt[i] = 0;
  }
  Serial.println("READY");
  Serial.println("SELECT:0");
}
void loop() {
  unsigned long now = millis();
  for (byte i = 0; i < COUNT; i++) {
    int reading = digitalRead(pins[i]);
    if (reading != lastReading[i]) {
      lastReading[i] = reading;
      changedAt[i] = now;
    }
    if (now - changedAt[i] >= 30 && reading != stableState[i]) {
      stableState[i] = reading;
      if (stableState[i] == LOW) {
        if (i == 0) {
          selected = selected % 5 + 1;
          Serial.print("SELECT:");
          Serial.println(selected);
        } else if (selected > 0) {
          Serial.print("SEND:");
          Serial.println(selected);
          selected = 0;
          Serial.println("SELECT:0");
        }
      }
    }
  }
}
